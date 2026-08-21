/**
 * SSO Routes — SAML/OIDC authentication for B2School
 * 
 * Endpoints:
 * GET  /api/v1/sso/providers — List configured providers for school
 * POST /api/v1/sso/providers — Create provider (admin)
 * GET  /api/v1/sso/providers/:id — Get provider config
 * PATCH /api/v1/sso/providers/:id — Update provider
 * DELETE /api/v1/sso/providers/:id — Delete provider
 * 
 * SAML:
 * GET  /api/v1/sso/saml/:providerId/login — Initiate SAML login
 * POST /api/v1/sso/saml/:providerId/acs — Assertion Consumer Service (callback)
 * GET  /api/v1/sso/saml/:providerId/metadata — SP metadata XML
 * GET  /api/v1/sso/saml/:providerId/logout — Initiate SAML logout
 * 
 * OIDC:
 * GET  /api/v1/sso/oidc/:providerId/login — Initiate OIDC login
 * GET  /api/v1/sso/oidc/:providerId/callback — OIDC callback
 * GET  /api/v1/sso/oidc/:providerId/logout — Initiate OIDC logout
 */
import { Router, Response, Request } from 'express';
import passport from 'passport';
import { query } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { 
  createSAMLStrategy, 
  createOIDCStrategy, 
  mapAttributes, 
  mapRole, 
  findOrCreateSSOUser,
  getProviderConfig,
  generateSAMLMetadata
} from '../services/sso';
import { randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';

const router = Router();
const requireAdmin = requireRole(['admin']);

// Store passport strategies by provider ID
const samlStrategies = new Map<string, any>();
const oidcStrategies = new Map<string, any>();

// Initialize passport serialization (using user ID)
passport.serializeUser((user: any, done) => done(null, user.id));
passport.deserializeUser(async (id: string, done) => {
  try {
    const result = await query('SELECT * FROM users WHERE id = $1', [id]);
    done(null, result.rows[0] || false);
  } catch (err) {
    done(err, false);
  }
});

/**
 * Initialize SAML strategy for a provider
 */
async function initSAMLStrategy(providerId: string): Promise<void> {
  const provider = await getProviderConfig(providerId);
  if (!provider || provider.providerType !== 'saml') return;
  
  const verifyFn = async (profile: any, done: Function) => {
    try {
      // Extract attributes using attribute_map
      const mapped = mapAttributes(profile, provider.attributeMap);
      const role = mapRole(profile, provider.roleMap, provider.defaultRole);
      
      const ssoProfile = {
        externalId: profile.nameID || profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'],
        email: mapped.email || profile.email,
        displayName: mapped.displayName || profile.displayName || profile.cn,
        role,
        rawProfile: profile,
      };
      
      const { user } = await findOrCreateSSOUser(provider.id, ssoProfile);
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  };
  
  const strategy = createSAMLStrategy(provider, verifyFn);
  samlStrategies.set(providerId, strategy);
  passport.use(`saml-${providerId}`, strategy as any);
}

/**
 * Initialize OIDC strategy for a provider
 */
async function initOIDCStrategy(providerId: string): Promise<void> {
  const provider = await getProviderConfig(providerId);
  if (!provider || provider.providerType !== 'oidc') return;
  
  const verifyFn = async (req: Request, issuer: string, sub: string, profile: any, jwtClaims: any, done: Function) => {
    try {
      const mapped = mapAttributes(profile, provider.attributeMap);
      const role = mapRole(profile, provider.roleMap, provider.defaultRole);
      
      const ssoProfile = {
        externalId: sub,
        email: mapped.email || profile.email,
        displayName: mapped.displayName || profile.name || profile.given_name + ' ' + profile.family_name,
        role,
        rawProfile: profile,
      };
      
      const { user } = await findOrCreateSSOUser(provider.id, ssoProfile);
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  };
  
  const strategy = createOIDCStrategy(provider, verifyFn as any);
  oidcStrategies.set(providerId, strategy);
  passport.use(`oidc-${providerId}`, strategy as any);
}

/**
 * Initialize all enabled providers on startup
 */
export async function initializeSSOStrategies(): Promise<void> {
  const result = await query('SELECT id FROM sso_providers WHERE enabled = TRUE');
  for (const row of result.rows) {
    const provider = await getProviderConfig(row.id);
    if (provider?.providerType === 'saml') {
      await initSAMLStrategy(provider.id);
    } else if (provider?.providerType === 'oidc') {
      await initOIDCStrategy(provider.id);
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Provider Management (Admin)
// ────────────────────────────────────────────────────────────────────────────
router.get('/providers', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      'SELECT id, school_id, provider_type, name, enabled, attribute_map, role_map, default_role, created_at FROM sso_providers WHERE school_id = $1 ORDER BY created_at DESC',
      [req.user!.school_id]
    );
    res.json({ providers: result.rows });
  } catch (error) {
    console.error('SSO providers list error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list providers' } });
  }
});

router.post('/providers', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { provider_type, name, ...config } = req.body;
  
  if (!provider_type || !['saml', 'oidc'].includes(provider_type)) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'provider_type must be saml or oidc' } });
  }
  if (!name) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'name is required' } });
  }
  
  try {
    const result = await query(
      `INSERT INTO sso_providers (school_id, provider_type, name, ${Object.keys(config).join(', ')})
       VALUES ($1, $2, $3, ${Object.values(config).map((_, i) => `$${i + 4}`).join(', ')})
       RETURNING *`,
      [req.user!.school_id, provider_type, name, ...Object.values(config)]
    );
    
    // Initialize strategy if enabled
    if (config.enabled) {
      if (provider_type === 'saml') await initSAMLStrategy(result.rows[0].id);
      else if (provider_type === 'oidc') await initOIDCStrategy(result.rows[0].id);
    }
    
    res.status(201).json({ provider: result.rows[0] });
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(409).json({ error: { code: 'CONFLICT', message: 'Provider name already exists for this school' } });
    }
    console.error('SSO provider create error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create provider' } });
  }
});

router.get('/providers/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      'SELECT * FROM sso_providers WHERE id = $1 AND school_id = $2',
      [req.params.id, req.user!.school_id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Provider not found' } });
    }
    // Don't return secrets
    const provider = result.rows[0];
    delete provider.oidc_client_secret;
    delete provider.saml_private_key;
    res.json({ provider });
  } catch (error) {
    console.error('SSO provider get error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get provider' } });
  }
});

router.patch('/providers/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { provider_type, name, ...config } = req.body;
    const updates: string[] = [];
    const values: any[] = [req.params.id, req.user!.school_id];
    let paramIndex = 3;
    
    if (name) { updates.push(`name = $${paramIndex++}`); values.push(name); }
    if (config.enabled !== undefined) { updates.push(`enabled = $${paramIndex++}`); values.push(config.enabled); }
    if (config.attribute_map) { updates.push(`attribute_map = $${paramIndex++}`); values.push(config.attribute_map); }
    if (config.role_map) { updates.push(`role_map = $${paramIndex++}`); values.push(config.role_map); }
    if (config.default_role) { updates.push(`default_role = $${paramIndex++}`); values.push(config.default_role); }
    
    // Provider-specific config
    const providerFields = ['saml_entry_point', 'saml_issuer', 'saml_cert', 'saml_private_key', 'saml_callback_url',
      'oidc_issuer', 'oidc_client_id', 'oidc_client_secret', 'oidc_callback_url', 'oidc_scope'];
    for (const field of providerFields) {
      if (config[field] !== undefined) {
        updates.push(`${field} = $${paramIndex++}`);
        values.push(config[field]);
      }
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'No updates provided' } });
    }
    
    updates.push(`updated_at = NOW()`);
    
    const result = await query(
      `UPDATE sso_providers SET ${updates.join(', ')} WHERE id = $1 AND school_id = $2 RETURNING *`,
      values
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Provider not found' } });
    }
    
    // Re-initialize strategy if enabled
    if (config.enabled) {
      if (result.rows[0].provider_type === 'saml') await initSAMLStrategy(result.rows[0].id);
      else if (result.rows[0].provider_type === 'oidc') await initOIDCStrategy(result.rows[0].id);
    }
    
    const provider = result.rows[0];
    delete provider.oidc_client_secret;
    delete provider.saml_private_key;
    res.json({ provider });
  } catch (error) {
    console.error('SSO provider update error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update provider' } });
  }
});

router.delete('/providers/:id', authenticate, requireAdmin, async (req: any, res: any) => {
  const authReq = req as AuthRequest;
  try {
    const providerId = req.params.id as string;
    const result = await query(
      'DELETE FROM sso_providers WHERE id = $1 AND school_id = $2 RETURNING id',
      [providerId, authReq.user!.school_id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Provider not found' } });
    }
    samlStrategies.delete(providerId);
    oidcStrategies.delete(providerId);
    res.json({ deleted: true });
  } catch (error) {
    console.error('SSO provider delete error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to delete provider' } });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// SAML Endpoints
// ────────────────────────────────────────────────────────────────────────────
router.get('/saml/:providerId/login', async (req: any, res: any, next: Function) => {
  const providerId = req.params.providerId as string;
  const provider = await getProviderConfig(providerId);
  if (!provider || provider.providerType !== 'saml') {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'SAML provider not found' } });
  }
  
  const strategy = samlStrategies.get(provider.id);
  if (!strategy) {
    await initSAMLStrategy(provider.id);
  }
  
  passport.authenticate(`saml-${provider.id}`, { failureRedirect: '/login?error=saml_failed' })(req, res, next);
});

router.post('/saml/:providerId/acs', async (req: any, res: any, next: Function) => {
  const providerId = req.params.providerId as string;
  const provider = await getProviderConfig(providerId);
  if (!provider || provider.providerType !== 'saml') {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'SAML provider not found' } });
  }
  
  const strategy = samlStrategies.get(provider.id);
  if (!strategy) {
    await initSAMLStrategy(provider.id);
  }
  
  passport.authenticate(`saml-${provider.id}`, { 
    failureRedirect: '/login?error=saml_failed',
    successRedirect: '/dashboard', // Frontend will handle token
  })(req, res, next);
});

router.get('/saml/:providerId/metadata', async (req: any, res: any) => {
  const providerId = req.params.providerId as string;
  const provider = await getProviderConfig(providerId);
  if (!provider || provider.providerType !== 'saml') {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'SAML provider not found' } });
  }
  
  const metadata = generateSAMLMetadata(provider);
  res.set('Content-Type', 'application/xml');
  res.send(metadata);
});

router.get('/saml/:providerId/logout', async (req: any, res: any) => {
  // SAML SLO not implemented - just clear local session
  res.redirect('/login?logged_out=true');
});

// ────────────────────────────────────────────────────────────────────────────
// OIDC Endpoints
// ────────────────────────────────────────────────────────────────────────────
router.get('/oidc/:providerId/login', async (req: any, res: any, next: Function) => {
  const providerId = req.params.providerId as string;
  const provider = await getProviderConfig(providerId);
  if (!provider || provider.providerType !== 'oidc') {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'OIDC provider not found' } });
  }
  
  const strategy = oidcStrategies.get(provider.id);
  if (!strategy) {
    await initOIDCStrategy(provider.id);
  }
  
  passport.authenticate(`oidc-${provider.id}`, { 
    scope: provider.oidcScope || 'openid email profile',
    failureRedirect: '/login?error=oidc_failed',
  })(req, res, next);
});

router.get('/oidc/:providerId/callback', async (req: any, res: any, next: Function) => {
  const providerId = req.params.providerId as string;
  const provider = await getProviderConfig(providerId);
  if (!provider || provider.providerType !== 'oidc') {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'OIDC provider not found' } });
  }
  
  const strategy = oidcStrategies.get(provider.id);
  if (!strategy) {
    await initOIDCStrategy(provider.id);
  }
  
  passport.authenticate(`oidc-${provider.id}`, { 
    failureRedirect: '/login?error=oidc_failed',
    successRedirect: '/dashboard',
  })(req, res, next);
});

router.get('/oidc/:providerId/logout', async (req: any, res: any) => {
  // OIDC RP-Initiated Logout
  const providerId = req.params.providerId as string;
  const provider = await getProviderConfig(providerId);
  if (!provider || provider.providerType !== 'oidc') {
    return res.redirect('/login?logged_out=true');
  }
  
  const logoutUrl = `${provider.oidcIssuer}/protocol/openid-connect/logout?post_logout_redirect_uri=${encodeURIComponent(process.env.FRONTEND_URL || 'http://localhost:5173')}`;
  res.redirect(logoutUrl);
});

// ────────────────────────────────────────────────────────────────────────────
// Session handling after SSO login
// ────────────────────────────────────────────────────────────────────────────
router.get('/session', authenticate, async (req: any, res: any) => {
  const authReq = req as AuthRequest;
  const user = authReq.user!;
  const preferredLang = user.preferredLanguage || user.preferred_language;
  // Return JWT for frontend after SSO login
  const token = jwt.sign(
    { id: user.id, role: user.role, preferredLanguage: preferredLang },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' }
  );
  
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie('token', token, {
    httpOnly: true,
    secure: isProd,
    sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
  
  res.json({ 
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      display_name: user.display_name,
      preferredLanguage: preferredLang
    },
    token
  });
});

export default router;