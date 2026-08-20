#!/usr/bin/env python3
"""
Detailed visual analysis script for Decodex - checks specific visual issues
"""

import asyncio
from playwright.async_api import async_playwright


async def analyze_visuals():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)

        # Desktop viewport
        desktop_context = await browser.new_context(
            viewport={"width": 1280, "height": 800},
            device_scale_factor=1
        )
        desktop_page = await desktop_context.new_page()

        # Mobile viewport
        mobile_context = await browser.new_context(
            viewport={"width": 375, "height": 667},
            device_scale_factor=2,
            is_mobile=True,
            has_touch=True
        )
        mobile_page = await mobile_context.new_page()

        # Test accounts
        STUDENT_EMAIL = "student@decodex.com"
        STUDENT_PASSWORD = "password123"
        TEACHER_EMAIL = "teacher@decodex.com"
        TEACHER_PASSWORD = "password123"

        async def login(page, email, password):
            await page.goto("http://localhost:5180/login")
            await page.wait_for_load_state("networkidle")
            await page.fill('input[type="email"]', email)
            await page.fill('input[type="password"]', password)
            await page.click('button[type="submit"]')
            await page.wait_for_load_state("networkidle")
            await page.wait_for_timeout(3000)
            # Debug: check current URL and user
            url = page.url
            print(f"  After login, URL: {url}")
            user_role = await page.evaluate("""
                () => {
                    try {
                        const auth = localStorage.getItem('auth') || sessionStorage.getItem('auth');
                        return auth ? JSON.parse(auth).user?.role : 'no auth';
                    } catch { return 'error'; }
                }
            """)
            print(f"  User role from storage: {user_role}")

        async def get_styles(page, selector):
            """Get computed styles for an element"""
            return await page.evaluate(f"""
                () => {{
                    const el = document.querySelector('{selector}');
                    if (!el) return null;
                    const styles = window.getComputedStyle(el);
                    return {{
                        fontFamily: styles.fontFamily,
                        borderRadius: styles.borderRadius,
                        boxShadow: styles.boxShadow,
                        backgroundColor: styles.backgroundColor,
                        color: styles.color,
                        padding: styles.padding,
                        margin: styles.margin,
                        position: styles.position,
                        zIndex: styles.zIndex,
                        bottom: styles.bottom,
                        left: styles.left,
                        right: styles.right,
                        top: styles.top,
                    }};
                }}
            """)

        async def check_element_overlap(page, selector1, selector2):
            """Check if two elements overlap"""
            return await page.evaluate(f"""
                () => {{
                    const el1 = document.querySelector('{selector1}');
                    const el2 = document.querySelector('{selector2}');
                    if (!el1 || !el2) return {{ overlap: false, reason: 'Element not found' }};

                    const rect1 = el1.getBoundingClientRect();
                    const rect2 = el2.getBoundingClientRect();

                    const overlap = !(
                        rect1.right < rect2.left ||
                        rect1.left > rect2.right ||
                        rect1.bottom < rect2.top ||
                        rect1.top > rect2.bottom
                    );

                    return {{
                        overlap,
                        rect1: {{ x: rect1.x, y: rect1.y, width: rect1.width, height: rect1.height }},
                        rect2: {{ x: rect2.x, y: rect2.y, width: rect2.width, height: rect2.height }},
                    }};
                }}
            """)

        async def check_theme(page, role_name):
            """Check theme-specific styles"""
            print(f"\n  --- {role_name} Theme Analysis ---")

            # Check root theme attribute
            theme = await page.evaluate("document.documentElement.getAttribute('data-theme')")
            print(f"  data-theme: {theme}")

            # Check font families
            body_font = await page.evaluate("window.getComputedStyle(document.body).fontFamily")
            print(f"  body font-family: {body_font}")

            # Check headings
            h1_font = await page.evaluate("""
                () => {
                    const h1 = document.querySelector('h1');
                    return h1 ? window.getComputedStyle(h1).fontFamily : 'no h1';
                }
            """)
            print(f"  h1 font-family: {h1_font}")

            # Check border radius on cards
            card_radius = await page.evaluate("""
                () => {
                    const card = document.querySelector('.stat-card, .glass-card, [class*="card"]');
                    return card ? window.getComputedStyle(card).borderRadius : 'no card';
                }
            """)
            print(f"  card border-radius: {card_radius}")

            # Check shadows
            card_shadow = await page.evaluate("""
                () => {
                    const card = document.querySelector('.stat-card, .glass-card, [class*="card"]');
                    return card ? window.getComputedStyle(card).boxShadow : 'no card';
                }
            """)
            print(f"  card box-shadow: {card_shadow}")

        # ============================================
        # 1. LANDING PAGE
        # ============================================
        print("\n" + "="*60)
        print("LANDING PAGE ANALYSIS")
        print("="*60)

        for page, label in [(desktop_page, "desktop"), (mobile_page, "mobile")]:
            await page.goto("http://localhost:5180/")
            await page.wait_for_load_state("networkidle")
            await page.wait_for_timeout(1000)

            print(f"\n  --- {label} ---")
            theme = await page.evaluate("document.documentElement.getAttribute('data-theme')")
            print(f"  data-theme: {theme}")
            body_font = await page.evaluate("window.getComputedStyle(document.body).fontFamily")
            print(f"  body font: {body_font}")

        # ============================================
        # 2. STUDENT DASHBOARD - Check Dex overlap
        # ============================================
        print("\n" + "="*60)
        print("STUDENT DASHBOARD - DEX OVERLAP CHECK")
        print("="*60)

        await login(desktop_page, STUDENT_EMAIL, STUDENT_PASSWORD)
        await login(mobile_page, STUDENT_EMAIL, STUDENT_PASSWORD)

        for page, label in [(desktop_page, "desktop"), (mobile_page, "mobile")]:
            await page.goto("http://localhost:5180/dashboard")
            await page.wait_for_load_state("networkidle")
            await page.wait_for_timeout(2000)

            print(f"\n  --- {label} ---")
            await check_theme(page, "Student")

            # Check Dex Navigation Guide button
            dex_btn = await page.locator('button:has-text("Read this to me")').count()
            if dex_btn > 0:
                dex_box = await page.locator('button:has-text("Read this to me")').bounding_box()
                print(f"  Dex button box: {dex_box}")

                # Check overlap with main content (use the second main which is the page content)
                main_content = await page.locator('main.flex-grow').bounding_box()
                print(f"  Main content box: {main_content}")

                # Check if it overlaps with footer or other elements
                footer = await page.locator('footer').count()
                if footer > 0:
                    footer_box = await page.locator('footer').bounding_box()
                    print(f"  Footer box: {footer_box}")

                    overlap = await check_element_overlap(page, 'button:has-text("Read this to me")', 'footer')
                    print(f"  Dex-Footer overlap: {overlap}")

                # Check overlap with action cards at bottom
                action_cards = await page.locator('.grid.grid-cols-1.sm\\:grid-cols-2.lg\\:grid-cols-4').count()
                if action_cards > 0:
                    cards_box = await page.locator('.grid.grid-cols-1.sm\\:grid-cols-2.lg\\:grid-cols-4').bounding_box()
                    print(f"  Action cards box: {cards_box}")

                    overlap = await check_element_overlap(page, 'button:has-text("Read this to me")', '[class*="grid-cols-1"][class*="grid-cols-2"][class*="grid-cols-4"]')
                    print(f"  Dex-ActionCards overlap: {overlap}")

            # Check Dex companion banner (the big one at top)
            dex_banner = await page.locator('img[alt="Dex"]').count()
            if dex_banner > 0:
                for i in range(dex_banner):
                    box = await page.locator('img[alt="Dex"]').nth(i).bounding_box()
                    print(f"  Dex avatar #{i} box: {box}")

        # ============================================
        # 3. PASSAGE SELECTION - Check Dex companion
        # ============================================
        print("\n" + "="*60)
        print("PASSAGE SELECTION - DEX COMPANION CHECK")
        print("="*60)

        for page, label in [(desktop_page, "desktop"), (mobile_page, "mobile")]:
            await page.goto("http://localhost:5180/passages")
            await page.wait_for_load_state("networkidle")
            await page.wait_for_timeout(1500)

            print(f"\n  --- {label} ---")
            await check_theme(page, "Student")

            # Check Dex avatar position
            dex_avatars = await page.locator('img[alt="Dex"]').count()
            print(f"  Dex avatars found: {dex_avatars}")
            for i in range(dex_avatars):
                box = await page.locator('img[alt="Dex"]').nth(i).bounding_box()
                print(f"  Dex avatar #{i} box: {box}")

            # Check if Dex overlaps with passage grid
            passage_grid = await page.locator('.grid.grid-cols-1.sm\\:grid-cols-2').count()
            if passage_grid > 0:
                grid_box = await page.locator('.grid.grid-cols-1.sm\\:grid-cols-2').bounding_box()
                print(f"  Passage grid box: {grid_box}")

                if dex_avatars > 0:
                    overlap = await check_element_overlap(page, 'img[alt="Dex"]', '[class*="grid-cols-1"][class*="grid-cols-2"]')
                    print(f"  Dex-Grid overlap: {overlap}")

        # ============================================
        # 4. TEACHER DASHBOARD
        # ============================================
        print("\n" + "="*60)
        print("TEACHER DASHBOARD THEME CHECK")
        print("="*60)

        await login(desktop_page, TEACHER_EMAIL, TEACHER_PASSWORD)
        await login(mobile_page, TEACHER_EMAIL, TEACHER_PASSWORD)

        for page, label in [(desktop_page, "desktop"), (mobile_page, "mobile")]:
            await page.goto("http://localhost:5180/teacher/dashboard")
            await page.wait_for_load_state("networkidle")
            await page.wait_for_timeout(2000)

            print(f"\n  --- {label} ---")
            await check_theme(page, "Teacher")

        # ============================================
        # 5. PARENT SESSION REPORT - Theme mixing check
        # ============================================
        print("\n" + "="*60)
        print("PARENT SESSION REPORT - THEME MIXING CHECK")
        print("="*60)

        await login(desktop_page, TEACHER_EMAIL, TEACHER_PASSWORD)
        await login(mobile_page, TEACHER_EMAIL, TEACHER_PASSWORD)

        for page, label in [(desktop_page, "desktop"), (mobile_page, "mobile")]:
            await page.goto("http://localhost:5180/parent/children/test-student/sessions/test-session")
            await page.wait_for_load_state("networkidle")
            await page.wait_for_timeout(2000)

            print(f"\n  --- {label} ---")
            await check_theme(page, "Parent (mixed)")

            # Check specific elements for mixed themes
            # Student-facing elements (should have student theme)
            student_elements = await page.locator('.student-text').count()
            print(f"  .student-text elements: {student_elements}")

            # Teacher-facing elements (should have teacher theme)
            teacher_elements = await page.locator('.teacher-mono').count()
            print(f"  .teacher-mono elements: {teacher_elements}")

            # Check cards
            cards = await page.locator('.stat-card').count()
            print(f"  .stat-card elements: {cards}")
            for i in range(min(cards, 3)):
                card = page.locator('.stat-card').nth(i)
                font = await card.evaluate("el => window.getComputedStyle(el).fontFamily")
                radius = await card.evaluate("el => window.getComputedStyle(el).borderRadius")
                print(f"  Card #{i} font: {font}, radius: {radius}")

        # ============================================
        # 6. STORY READER PAGE
        # ============================================
        print("\n" + "="*60)
        print("STORY READER PAGE CHECK")
        print("="*60)

        await login(desktop_page, STUDENT_EMAIL, STUDENT_PASSWORD)
        await login(mobile_page, STUDENT_EMAIL, STUDENT_PASSWORD)

        for page, label in [(desktop_page, "desktop"), (mobile_page, "mobile")]:
            await page.goto("http://localhost:5180/stories")
            await page.wait_for_load_state("networkidle")
            await page.wait_for_timeout(2000)

            print(f"\n  --- {label} ---")
            await check_theme(page, "Student (StoryReader)")

            # Check Dex avatar in reader
            dex_avatars = await page.locator('img[alt="Dex"]').count()
            print(f"  Dex avatars: {dex_avatars}")

        # ============================================
        # 7. SKELETON LOADING STATES - SKIPPED (timing out)
        # ============================================
        print("\n" + "="*60)
        print("SKELETON LOADING STATES CHECK - SKIPPED")
        print("="*60)
        print("  Skipping due to API interception timeout issues")

        # ============================================
        # 8. LOGIN/REGISTER - Dex encouragement
        # ============================================
        print("\n" + "="*60)
        print("LOGIN/REGISTER - DEX ENCOURAGEMENT CHECK")
        print("="*60)

        # Logout
        await desktop_page.goto("http://localhost:5180/logout")
        await mobile_page.goto("http://localhost:5180/logout")
        await desktop_page.wait_for_load_state("networkidle")
        await mobile_page.wait_for_load_state("networkidle")

        for page, label in [(desktop_page, "desktop"), (mobile_page, "mobile")]:
            await page.goto("http://localhost:5180/login")
            await page.wait_for_load_state("networkidle")
            await page.wait_for_timeout(1000)

            print(f"\n  --- Login {label} ---")
            dex_avatars = await page.locator('img[alt="Dex"]').count()
            print(f"  Dex avatars: {dex_avatars}")
            for i in range(dex_avatars):
                box = await page.locator('img[alt="Dex"]').nth(i).bounding_box()
                print(f"  Dex avatar #{i} box: {box}")

            # Check if Dex overlaps with form
            form = await page.locator('form').bounding_box()
            print(f"  Form box: {form}")

            if dex_avatars > 0:
                overlap = await check_element_overlap(page, 'img[alt="Dex"]', 'form')
                print(f"  Dex-Form overlap: {overlap}")

        for page, label in [(desktop_page, "desktop"), (mobile_page, "mobile")]:
            await page.goto("http://localhost:5180/register")
            await page.wait_for_load_state("networkidle")
            await page.wait_for_timeout(1000)

            print(f"\n  --- Register {label} ---")
            dex_avatars = await page.locator('img[alt="Dex"]').count()
            print(f"  Dex avatars: {dex_avatars}")

        await browser.close()
        print("\nAnalysis complete!")


if __name__ == "__main__":
    asyncio.run(analyze_visuals())