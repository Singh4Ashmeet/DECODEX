#!/usr/bin/env python3
"""
Visual testing script for Decodex - captures screenshots of key pages
at desktop and mobile widths.
"""

import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

async def capture_screenshots():
    screenshots_dir = Path("visual_test_screenshots")
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
            await page.goto("http://localhost:5173/login")
            await page.wait_for_load_state("networkidle")
            await page.fill('input[type="email"]', email)
            await page.fill('input[type="password"]', password)
            await page.click('button[type="submit"]')
            await page.wait_for_load_state("networkidle")
            await page.wait_for_timeout(1000)  # Wait for auth redirect

        async def capture(page, name, width_label):
            await page.wait_for_load_state("networkidle")
            await page.wait_for_timeout(500)  # Let animations settle
            path = screenshots_dir / f"{name}_{width_label}.png"
            await page.screenshot(path=path, full_page=True)
            print(f"  Captured: {path}")

        # ============================================
        # 1. LANDING PAGE (no auth required)
        # ============================================
        print("\n=== LandingPage ===")
        for page, label in [(desktop_page, "desktop"), (mobile_page, "mobile")]:
            await page.goto("http://localhost:5173/")
            await page.wait_for_load_state("networkidle")
            await page.wait_for_timeout(1000)
            await capture(page, "LandingPage", label)

        # ============================================
        # 2. STUDENT DASHBOARD
        # ============================================
        print("\n=== Student Dashboard ===")
        await login(desktop_page, STUDENT_EMAIL, STUDENT_PASSWORD)
        await login(mobile_page, STUDENT_EMAIL, STUDENT_PASSWORD)
        
        for page, label in [(desktop_page, "desktop"), (mobile_page, "mobile")]:
            await page.goto("http://localhost:5173/dashboard")
            await page.wait_for_load_state("networkidle")
            await page.wait_for_timeout(1500)  # Wait for data to load
            await capture(page, "Dashboard_Student", label)

        # Check Dex overlap on mobile
        print("  Checking Dex overlap on mobile Dashboard...")
        mobile_dex = await mobile_page.locator('button:has-text("Read this to me")').count()
        if mobile_dex > 0:
            dex_box = await mobile_page.locator('button:has-text("Read this to me")').bounding_box()
            print(f"  Dex button position: {dex_box}")
        
        # ============================================
        # 3. PASSAGE SELECTION
        # ============================================
        print("\n=== PassageSelection ===")
        for page, label in [(desktop_page, "desktop"), (mobile_page, "mobile")]:
            await page.goto("http://localhost:5173/passages")
            await page.wait_for_load_state("networkidle")
            await page.wait_for_timeout(1500)
            await capture(page, "PassageSelection", label)

        # Check Dex companion on mobile
        print("  Checking Dex companion on mobile PassageSelection...")
        mobile_dex_avatar = await mobile_page.locator('img[alt="Dex"]').count()
        if mobile_dex_avatar > 0:
            dex_box = await mobile_page.locator('img[alt="Dex"]').first.bounding_box()
            print(f"  Dex avatar position: {dex_box}")

        # ============================================
        # 4. TEACHER DASHBOARD
        # ============================================
        print("\n=== Teacher Dashboard ===")
        await login(desktop_page, TEACHER_EMAIL, TEACHER_PASSWORD)
        await login(mobile_page, TEACHER_EMAIL, TEACHER_PASSWORD)
        
        for page, label in [(desktop_page, "desktop"), (mobile_page, "mobile")]:
            await page.goto("http://localhost:5173/teacher/dashboard")
            await page.wait_for_load_state("networkidle")
            await page.wait_for_timeout(1500)
            await capture(page, "TeacherDashboard", label)

        # ============================================
        # 5. READING SESSION - STORY READER PAGE
        # ============================================
        print("\n=== StoryReaderPage (reading session) ===")
        await login(desktop_page, STUDENT_EMAIL, STUDENT_PASSWORD)
        await login(mobile_page, STUDENT_EMAIL, STUDENT_PASSWORD)
        
        for page, label in [(desktop_page, "desktop"), (mobile_page, "mobile")]:
            await page.goto("http://localhost:5173/stories")
            await page.wait_for_load_state("networkidle")
            await page.wait_for_timeout(1500)
            await capture(page, "StoryReaderPage", label)

        # Also capture PracticePage if it exists
        print("\n=== PracticePage (reading session) ===")
        for page, label in [(desktop_page, "desktop"), (mobile_page, "mobile")]:
            # Try to access a practice page - might need a session ID
            await page.goto("http://localhost:5173/sessions/test-session/practice")
            await page.wait_for_load_state("networkidle")
            await page.wait_for_timeout(1500)
            await capture(page, "PracticePage", label)

        # ============================================
        # 6. PARENT SESSION REPORT (theme mixing check)
        # ============================================
        print("\n=== ParentSessionReport (theme mixing) ===")
        await login(desktop_page, TEACHER_EMAIL, TEACHER_PASSWORD)
        await login(mobile_page, TEACHER_EMAIL, TEACHER_PASSWORD)
        
        # Note: This might not have data without a real student/session
        # We'll try to access it anyway to see the layout
        for page, label in [(desktop_page, "desktop"), (mobile_page, "mobile")]:
            await page.goto("http://localhost:5173/parent/children/test-student/sessions/test-session")
            await page.wait_for_load_state("networkidle")
            await page.wait_for_timeout(1500)
            await capture(page, "ParentSessionReport", label)

        # ============================================
        # 7. LOGIN PAGE (Dex encouragement)
        # ============================================
        print("\n=== Login Page (Dex encouragement) ===")
        # Logout first
        await desktop_page.goto("http://localhost:5173/logout")
        await mobile_page.goto("http://localhost:5173/logout")
        await desktop_page.wait_for_load_state("networkidle")
        await mobile_page.wait_for_load_state("networkidle")
        
        for page, label in [(desktop_page, "desktop"), (mobile_page, "mobile")]:
            await page.goto("http://localhost:5173/login")
            await page.wait_for_load_state("networkidle")
            await page.wait_for_timeout(1000)
            await capture(page, "LoginPage", label)

        # ============================================
        # 8. REGISTER PAGE
        # ============================================
        print("\n=== Register Page ===")
        for page, label in [(desktop_page, "desktop"), (mobile_page, "mobile")]:
            await page.goto("http://localhost:5173/register")
            await page.wait_for_load_state("networkidle")
            await page.wait_for_timeout(1000)
            await capture(page, "RegisterPage", label)

        await browser.close()
        print(f"\n✅ All screenshots saved to {screenshots_dir.absolute()}")

if __name__ == "__main__":
    asyncio.run(capture_screenshots())