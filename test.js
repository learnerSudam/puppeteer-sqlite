const getAllcategories = async (url, locator) => {
  const puppeteer = require("puppeteer");
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1920, height: 1080 },
  });
  const page = await browser.newPage();
  await page.goto(url);
  const categoryLinks = await page.$$eval(locator, (elements) =>
    elements.map((e) => e.href)
  );
  const categoryNames = await page.$$eval(locator, (elements) =>
    elements.map((e) => e.innerText)
  );
  const result = [browser, categoryNames, categoryLinks];
  return result;
};

const getBooksFromEachCategoryPage = async (
  page,
  booksData,
  categotyNameLocator,
  booksLocator
) => {
  const categoryName = await page.$eval(
    categotyNameLocator,
    (element) => element.innerText
  );
  const allBooks = await page.$$eval(booksLocator, (elements) =>
    elements.map((e) => ({
      bookName: e.querySelector("h3 a").getAttribute("title"),
      price: e.querySelector(".price_color").innerText,
      imageSrc: e.querySelector("img").getAttribute("src"),
      rating: e.querySelector(".star-rating").classList[1],
    }))
  );
  booksData.push({ categoryName, allBooks });
  const nextButton = await page.$(".next a");
  if (nextButton) {
    await Promise.all([page.waitForNavigation(), nextButton.click()]);
    await getBooksFromEachCategoryPage(
      page,
      booksData,
      categotyNameLocator,
      booksLocator
    );
  }
};

const getAllBooks = async (result) => {
  const browser = result[0];
  const categoryLinks = result[2];
  const booksData = [];
  for (const categoryLink of categoryLinks) {
    const page = await browser.newPage();
    await page.goto(categoryLink);
    await getBooksFromEachCategoryPage(
      page,
      booksData,
      ".page-header h1",
      ".product_pod"
    );
    await page.close();
  }
  await browser.close();
  return booksData;
};

const createDbName = (number) => {
  let result = "";
  let characters = "0123456789";
  let charactersLength = characters.length;
  for (var i = 0; i < number; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return `Test ${result}.db`;
};

const insertCategories = async (db, categories) => {
  let insertIntoCategories = `INSERT INTO categories(category_name) VALUES (?) `;
  for (const category of categories) {
    await db.run(insertIntoCategories, [category], (err) => {
      if (err) return console.error(err.message);
    });
  }
};

const insertCategoryIdInsdieBook = async (db, booksData) => {
  for (const books of booksData) {
    const category = books.categoryName;
    const categoryId = await getCategoryId(db, category);
    for (const book of books.allBooks) {
      book["category_Id"] = categoryId;
      const updatedBook = await updateBookData(book);
      insertIntoBooks(db, updatedBook);
    }
  }
};

const getCategoryId = async (db, category) => {
  const getCategoryIdQuery = `SELECT category_id FROM categories WHERE category_name = ?`;
  return new Promise((resolve, reject) => {
    db.get(getCategoryIdQuery, [category], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row.category_id);
      }
    });
  });
};

const updateBookData = async (book) => {
  const converToprice = (price) => {
    return parseFloat(price.replace("£", ""));
  };

  const convertRating = (rating) => {
    switch (rating) {
      case "One":
        return 1;
      case "Two":
        return 2;
      case "Three":
        return 3;
      case "Four":
        return 4;
      case "Five":
        return 5;
      default:
        return 0;
    }
  };
  const url = "https://books.toscrape.com/";

  const updatedBook = {
    Name: book.bookName,
    categoryId: book.category_Id,
    Price: converToprice(book.price),
    imageSrc: url + book.imageSrc,
    rating: convertRating(book.rating),
  };
  return updatedBook;
};

const insertIntoBooks = async (db, book) => {
  const query = `INSERT INTO books(book_name, category_id, book_price, book_imageSrc, book_rating) VALUES (?, ?, ?, ?, ?)`;
  await db.run(
    query,
    [book.Name, book.categoryId, book.Price, book.imageSrc, book.rating],
    (err) => {
      if (err) return console.error(err.message);
    }
  );
};
const main = async (number) => {
  const dbName = createDbName(number);
  const sqlite3 = require("sqlite3").verbose();
  const db = new sqlite3.Database(
    dbName,
    sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
    (err) => {
      if (err) return console.error(err.message);
      else {
        console.log(`New database "${dbName}" created successfully.`);
      }
    }
  );
  const createCategoriesTable = `CREATE TABLE if not exists categories(category_id INTEGER PRIMARY KEY, category_name TEXT)`;
  const cretateBooksTable = `CREATE TABLE if not exists books(book_id INTEGER PRIMARY KEY, book_name TEXT, category_id INTEGER, book_price INTEGER, book_imageSrc TEXT, book_rating INTEGER, FOREIGN KEY(category_id) REFERENCES categories (category_id) )`;
  db.run(createCategoriesTable);
  db.run(cretateBooksTable);
  const result = await getAllcategories(
    "https://books.toscrape.com/",
    ".nav ul li a"
  );
  if (result) {
    const categoryNames = result[1];
    insertCategories(db, categoryNames);
    const booksData = await getAllBooks(result);
    if (booksData) {
      await insertCategoryIdInsdieBook(db, booksData);
    }
  }
};

module.exports = main;
