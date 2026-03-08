const puppeteer = require('puppeteer');
const fs = require('fs');

// added the credentials, package-lock, and package json files to .gitignore as stated in ReadMe.md

// Load the credentials from the 'credentials.json' file
const credentials = fs.readFileSync('credentials.json');
const { username, password } = JSON.parse(credentials);

(async () => {
    // Launch a browser instance and open a new page
    const browser = await puppeteer.launch({headless: false,  args: ['--no-sandbox', '--disable-setuid-sandbox']}); // removing the sandbox to run the code
    const page = await browser.newPage();

    // Navigate to GitHub login page
    await page.goto('https://github.com/login');

    // Login to GitHub using the provided credentials
    await page.type('#login_field', username);
    await page.type('#password', password);
    await page.click('input[name="commit"]');

    // Wait for successful login
    await page.waitForSelector('.avatar.circle');

    // Extract the actual GitHub username to be used later
    const actualUsername = await page.$eval('meta[name="octolytics-actor-login"]', meta => meta.content);

    const repositories = ["cheeriojs/cheerio", "axios/axios", "puppeteer/puppeteer"];

    for (const repo of repositories) {
        await page.goto(`https://github.com/${repo}`);

        // Star the repository
        await page.click('form[action$="/star"] button',{ visible: true });
        await new Promise(resolve => setTimeout(resolve, 1000)); // This timeout helps ensure that the action is fully processed

    }

    // Navigate to the user's starred repositories page
    await page.goto(`https://github.com/${actualUsername}?tab=stars`);

    // Click on the "Create list" button
    await page.waitForSelector('.Button--primary.Button--medium.Button');
    await page.click('.Button--primary.Button--medium.Button');

    // Create a list named "Node Libraries"
    await page.waitForSelector('#user_list_name');
    await page.type('#user_list_name', 'Node Libraries');
    // Wait for buttons to become visible
    // Puppeteer removed waitfortimeout in versions on/after 23, so I'ma use promise
    await new Promise(resolve => setTimeout(resolve, 1000));

    const buttons = await page.$$('.Button--primary.Button--medium.Button');
    for (const button of buttons) {
        const buttonText = await button.evaluate(node => node.textContent.trim());
        if (buttonText === 'Create') {
            await button.click();
            // this may look silly, but Github didn't actually register the first click - I tested this by creating a test list manually and clicking create button
            // Github first verifies the name on first click and on second click, that's when the list is actually created
            await new Promise(resolve => setTimeout(resolve, 500));
            await button.click();
            break;
        }
    }

    // Allow some time for the list creation process
    await new Promise(resolve => setTimeout(resolve, 2000));

    for (const repo of repositories) {
        await page.goto(`https://github.com/${repo}`);

        // Add this repository to the "Node Libraries" list
        const dropdownSelector = 'details.js-user-list-menu';
        await page.waitForSelector(dropdownSelector);
        await page.click(dropdownSelector);
        await new Promise(resolve => setTimeout(resolve, 1000));
        const lists = await page.$$('.js-user-list-menu-form');

        for (const list of lists) {
          const textHandle = await list.getProperty('innerText');
          const text = await textHandle.jsonValue();
          if (text.includes('Node Libraries')) {
            await list.click();
            break;
          }
        }

        // Allow some time for the action to process
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Close the dropdown to finalize the addition to the list
        await page.click(dropdownSelector);

        await new Promise(resolve => setTimeout(resolve, 1000)); // wait for the action to complete before moving to the next repository
      }
    // Go back to the stars page to make sure the list is created
    await page.goto(`https://github.com/${actualUsername}?tab=stars`);
    new Promise(resolve => setTimeout(resolve, 1000)); // Wait for the page to load completely before taking the screenshot
    // verifying that I have the Node Libraries list + the starred repositories
    await page.screenshot({ path: 'stars_page.png', fullPage: true });
    // Close the browser
    await browser.close();
})();
