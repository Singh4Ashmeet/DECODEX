from playwright.sync_api import sync_playwright


def login(page, email: str) -> None:
    page.goto('http://localhost:5173/login')
    page.wait_for_load_state('networkidle')
    page.get_by_label('Email Address').fill(email)
    page.get_by_label('Password').fill('password123')
    page.get_by_role('button', name='Log In').click()
    page.wait_for_load_state('networkidle')


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1440, 'height': 1000})
    page.on('console', lambda message: print(f'BROWSER {message.type}: {message.text}') if message.type == 'error' else None)

    login(page, 'teacher@decodex.com')
    page.get_by_role('button', name='Assignments').click()
    page.wait_for_load_state('networkidle')
    page.get_by_label('Title').fill('Browser assignment check')
    passage_select = page.locator('select').first
    passage_select.select_option(index=1)
    page.get_by_role('button', name='Create assignment').click()
    page.get_by_text('Assignment created and shared with students.').wait_for()
    page.screenshot(path='test-results/teacher-assignment.png', full_page=True)

    page.context.clear_cookies()
    login(page, 'student@decodex.com')
    page.get_by_role('heading', name='Assigned Practice').wait_for()
    page.get_by_text('Browser assignment check').wait_for()
    assert page.get_by_role('heading', name='Start Reading').is_visible()
    page.get_by_role('button', name='Start assignment').click()
    page.wait_for_url('**/session/**?sessionId=*')
    page.wait_for_load_state('networkidle')
    assert 'Browser assignment check' not in page.title()
    assert page.locator('article').first.is_visible()
    page.screenshot(path='test-results/student-assignment-session.png', full_page=True)
    print('BROWSER_ASSIGNMENT_FLOW_OK')
    browser.close()
