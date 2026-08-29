/**
 * SSO Service — SAML/OIDC authentication for B2School
 * 
 * Supports:
 * - SAML 2.0 (passport-saml) — Azure AD, Okta, ADFS, etc.
 * - OIDC (passport-openidconnect) — Google Workspace, generic OIDC
 * - JIT (Just-In-Time) provisioning for new users
 * - Attribute & role mapping from IdP claims
 */
import { Strategy as SAMLStrategy } from '@node-saml/passport-saml';
import { Strategy as OIDCStrategy } from 'passport-openidconnect';
import { query } from '../db';
import { encryptUserPII, hashEmail } from './piiEncryption';
import { randomBytes } from 'crypto';
import bcrypt from 'bcrypt';

export interface SSOProviderConfig {
  id: string;
  schoolId: string;
  providerType: 'saml' | 'oidc';
  name: string;
  enabled: boolean;
  // SAML
  samlEntryPoint?: string;
  samlIssuer?: string;
  samlCert?: string;
  samlPrivateKey?: string;
  samlCallbackUrl?: string;
  // OIDC
  oidcIssuer?: string;
  oidcClientId?: string;
  oidcClientSecret?: string;
  oidcCallbackUrl?: string;
  oidcScope?: string;
  // Mapping
  attributeMap: Record<string, string>;
  roleMap: Record<string, string>;
  defaultRole: string;
}

export interface SSOUserProfile {
  externalId: string;
  email: string;
  displayName: string;
  role?: string;
  rawProfile: any;
}

/**
 * Create SAML strategy for a provider
 */
export function createSAMLStrategy(provider: SSOProviderConfig, verifyFn: (profile: any, done: Function) => void): SAMLStrategy {
  const samlConfig: any = {
    entryPoint: provider.samlEntryPoint,
    issuer: provider.samlIssuer,
    callbackUrl: provider.samlCallbackUrl,
    cert: provider.samlCert || '',
    privateKey: provider.samlPrivateKey,
    decryptionPvk: provider.samlPrivateKey,
    identifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    acceptedClockSkewMs: 5000,
    wantAssertionsSigned: true,
    wantMessageSigned: true,
    forceAuthn: false,
    providerName: provider.name,
  };
  return new SAMLStrategy(samlConfig, verifyFn as any, verifyFn as any);
}

/**
 * Create OIDC strategy for a provider
 */
export function createOIDCStrategy(provider: SSOProviderConfig, verifyFn: (iss: string, sub: string, profile: any, jwtClaims: any, done: Function) => void): OIDCStrategy {
  const oidcConfig: any = {
    issuer: provider.oidcIssuer,
    authorizationURL: `${provider.oidcIssuer}/authorize`,
    tokenURL: `${provider.oidcIssuer}/token`,
    userInfoURL: `${provider.oidcIssuer}/userinfo`,
    clientID: provider.oidcClientId || '',
    clientSecret: provider.oidcClientSecret || '',
    callbackURL: provider.oidcCallbackUrl || '',
    scope: provider.oidcScope || 'openid email profile',
    passReqToCallback: true,
  };
  return new OIDCStrategy(oidcConfig, verifyFn as any);
}

/**
 * Map IdP attributes to Decodex user fields using attribute_map
 */
export function mapAttributes(rawProfile: any, attributeMap: Record<string, string>): Partial<SSOUserProfile> {
  const mapped: Partial<SSOUserProfile> = {};
  
  for (const [decodexField, idpField] of Object.entries(attributeMap)) {
    const value = getNestedValue(rawProfile, idpField);
    if (value !== undefined) {
      (mapped as any)[decodexField] = value;
    }
  }
  
  return mapped;
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Map IdP role/group to Decodex role using role_map
 */
export function mapRole(rawProfile: any, roleMap: Record<string, string>, defaultRole: string): string {
  // Check for role in mapped attributes first
  for (const [idpRole, decodexRole] of Object.entries(roleMap)) {
    // Check if user has this role in their profile (groups, roles, etc.)
    const groups = rawProfile.groups || rawProfile['groups'] || rawProfile['https://schemas.microsoft.com/ws/2008/06/identity/claims/groups'] || [];
    const roles = rawProfile.roles || rawProfile['roles'] || rawProfile['role'] || [];
    
    const allRoles = [...(Array.isArray(groups) ? groups : [groups]), ...(Array.isArray(roles) ? roles : [roles])];
    
    if (allRoles.some((r: string) => r.toLowerCase().includes(idpRole.toLowerCase()))) {
      return decodexRole;
    }
  }
  
  return defaultRole;
}

/**
 * Find or create user from SSO profile (JIT provisioning)
 */
export async function findOrCreateSSOUser(
  providerId: string,
  ssoProfile: SSOUserProfile
): Promise<{ user: any; isNew: boolean }> {
  // Check existing link
  const linkResult = await query(
    'SELECT user_id FROM sso_user_links WHERE provider_id = $1 AND external_id = $2',
    [providerId, ssoProfile.externalId]
  );
  
  if (linkResult.rows.length > 0) {
    // Update last login
    await query(
      'UPDATE sso_user_links SET last_login_at = NOW() WHERE provider_id = $1 AND external_id = $2',
      [providerId, ssoProfile.externalId]
    );
    
    const userResult = await query('SELECT * FROM users WHERE id = $1', [linkResult.rows[0].user_id]);
    return { user: userResult.rows[0], isNew: false };
  }
  
  // Check if user exists by email (deterministic hash lookup)
  const emailHash = hashEmail(ssoProfile.email);
  const userResult = await query('SELECT * FROM users WHERE email_hash = $1 AND deleted_at IS NULL', [emailHash]);
  
  const encryptedEmail = encryptUserPII({ email: ssoProfile.email }).email;
  let user;
  let isNew = false;
  
  if (userResult.rows.length > 0) {
    user = userResult.rows[0];
    // Link existing user to SSO
    await query(
      'INSERT INTO sso_user_links (provider_id, external_id, external_email, user_id) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
      [providerId, ssoProfile.externalId, encryptedEmail, user.id]
    );
  } else {
    // Create new user (JIT provisioning)
    isNew = true;
    const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 12);
    const encryptedDisplayName = encryptUserPII({ display_name: ssoProfile.displayName }).display_name;
    
    const ssoEmailHash = hashEmail(ssoProfile.email);
    const newUserResult = await query(
      `INSERT INTO users (email, password_hash, role, display_name, school_id, email_hash)
       VALUES ($1, $2, $3, $4, (SELECT school_id FROM sso_providers WHERE id = $5), $6)
       RETURNING *`,
      [encryptedEmail, passwordHash, ssoProfile.role || 'teacher', encryptedDisplayName, providerId, ssoEmailHash]
    );
    
    user = newUserResult.rows[0];
    
    // Link new user to SSO
    await query(
      'INSERT INTO sso_user_links (provider_id, external_id, external_email, user_id) VALUES ($1, $2, $3, $4)',
      [providerId, ssoProfile.externalId, encryptedEmail, user.id]
    );
  }
  
  return { user, isNew };
}

/**
 * Get provider config from DB
 */
export async function getProviderConfig(providerId: string): Promise<SSOProviderConfig | null> {
  const result = await query('SELECT * FROM sso_providers WHERE id = $1 AND enabled = TRUE', [providerId]);
  return result.rows[0] || null;
}

/**
 * Get provider by school and type
 */
export async function getProviderBySchool(schoolId: string, providerType: 'saml' | 'oidc'): Promise<SSOProviderConfig | null> {
  const result = await query(
    'SELECT * FROM sso_providers WHERE school_id = $1 AND provider_type = $2 AND enabled = TRUE LIMIT 1',
    [schoolId, providerType]
  );
  return result.rows[0] || null;
}

/**
 * Generate SAML metadata XML for SP
 */
export function generateSAMLMetadata(provider: SSOProviderConfig): string {
  const entityId = provider.samlIssuer;
  const acsUrl = provider.samlCallbackUrl;
  const cert = provider.samlCert?.replace(/-----BEGIN CERTIFICATE-----/g, '').replace(/-----END CERTIFICATE-----/g, '').replace(/\n/g, '');
  
  return `<?xml version="1.0"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${entityId}">
  <md:SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol" AuthnRequestsSigned="true" WantAssertionsSigned="true">
    <md:KeyDescriptor use="signing">
      <ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
        <ds:X509Data>
          <ds:X509Certificate>${cert}</ds:X509Certificate>
        </ds:X509Data>
      </ds:KeyInfo>
    </md:KeyDescriptor>
    <md:KeyDescriptor use="encryption">
      <ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
        <ds:X509Data>
          <ds:X509Certificate>${cert}</ds:X509Certificate>
        </ds:X509Data>
      </ds:KeyInfo>
    </md:KeyDescriptor>
    <md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${acsUrl}" index="0" isDefault="true"/>
    <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>
  </md:SPSSODescriptor>
</md:EntityDescriptor>`;
}