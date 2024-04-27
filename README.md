In this rep we have used puppeteer to scrape the data and sqlite3 to store the scraped data.
run **npm install** to  add the required dependencies

run the script by **npm run test** 

It will navigate to https://books.toscrape.com and get the category names of the books. Then it will navigate inside each category and scrape the books data. In the
Db we have created 2 tables category and book. Category id from books table has foreign key relation with id of category table.