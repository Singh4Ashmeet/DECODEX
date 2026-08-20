#!/usr/bin/env python3
"""
Simple visual test - just captures screenshots of key pages
"""

import asyncio
from playwright.async_api import async_playwright

async def capture_screenshots():
    screenshots_dir = Path("visual_test_screenshots_v2")
    screenshots_dir.mkdir(exist_ok=True)

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

        async def capture(page, name, width_label):
            await page.wait_for_load_state("networkidle")
            await page.wait_for_timeout(1000)
            path = screenshots_dir / f"{name}_{width_label}.png"
            await page.screenshot(path=path, full_page=True)
            print(f"  Captured: {path}")

        # ============================================
        # 1. LANDING PAGE (no auth required)
        # ============================================
        print("\n=== LandingPage ===")
        for page, label in [(desktop_page, "desktop"), (mobile_page, "mobile")]:
            await page.goto("http://localhost:5180/")
            await capture(page, "LandingPage", label)

        # ============================================
        # 2. STUDENT DASHBOARD
        # ============================================
        print("\n=== Student Dashboard ===")
        await login(desktop_page, STUDENT_EMAIL, STUDENT_PASSWORD)
        await login(mobile_page, STUDENT_EMAIL, STUDENT_PASSWORD)
        
        for page, label in [(desktop_page, "desktop"), (mobile_page, "mobile")]:
            await page.goto("http://localhost:5180/dashboard")
            await capture(page, "Dashboard_Student", label)

        # ============================================
        # 3. PASSAGE SELECTION
        # ============================================
        print("\n=== PassageSelection ===")
        for page, label in [(desktop_page, "desktop"), (mobile_page, "mobile")]:
            await page.goto("http://localhost:5180/passages")
            await capture(page, "PassageSelection", label)

        # ============================================
        # 4. TEACHER DASHBOARD
        # ============================================
        print("\n=== Teacher Dashboard ===")
        await login(desktop_page, TEACHER_EMAIL, TEACHER_PASSWORD)
        await login(mobile_page, TEACHER_EMAIL, TEACHER_PASSWORD)
        
        for page, label in [(desktop_page, "desktop"), (mobile_page, "mobile")]:
            await page.goto("http://localhost:5180/teacher/dashboard")
            await capture(page, "TeacherDashboard", label)

        # ============================================
        # 5. STORY READER PAGE
        # ============================================
        print("\n=== StoryReaderPage ===")
        await login(desktop_page, STUDENT_EMAIL, STUDENT_PASSWORD)
        await login(mobile_page, STUDENT_EMAIL, STUDENT_PASSWORD)
        
        for page, label in [(desktop_page, "desktop"), (mobile_page, "mobile")]:
            await page.goto("http://localhost:5180/stories")
            await capture(page, "StoryReaderPage", label)

        # ============================================
        # 6. PARENT SESSION REPORT
        # ============================================
        print("\n=== ParentSessionReport ===")
        await login(desktop_page, TEACHER_EMAIL, TEACHER_PASSWORD)
        await login(mobile_page, TEACHER_EMAIL, TEACHER_PASSWORD)
        
        for page, label in [(desktop_page, "desktop"), (mobile_page, "mobile")]:
            await page.goto("http://localhost:5180/parent/children/test-student/sessions/test-session")
            await capture(page, "ParentSessionReport", label)

        # ============================================
        # 7. LOGIN PAGE
        # ============================================
        print("\n=== LoginPage ===")
        # Create fresh pages without auth
        login_desktop = await desktop_context.new_page()
        login_mobile = await mobile_context.new_page()
        
        for page, label in [(login_desktop, "desktop"), (login_mobile, "mobile")]:
            await page.goto("http://localhost:5180/login")
            await capture(page, "LoginPage", label)

        # ============================================
        # 8. REGISTER PAGE
        # ============================================
        print("\n=== RegisterPage ===")
        register_desktop = await desktop_context.new_page()
        register_mobile = await mobile_context.new_page()
        
        for page, label in [(register_desktop, "desktop"), (register_mobile, "mobile")]:
            await page.goto("http://localhost:5180/register")
            await capture(page, "RegisterPage", label)

        await browser.close()
        print(f"\nAll screenshots saved to {screenshots_dir.absolute()}")

if __name__ == "__main__":
    from pathlib import Path
    asyncio.run(capture_screenshots())