/* eslint-disable eqeqeq */
const express = require('express');
const xss = require('xss');
const logger = require('../logger');
const bookmarksService = require('../bookmarks/bookmarksService');

const bookmarkRouter = express.Router();
const bodyParser = express.json();

const serializeBookmark = bookmark => ({
  id: bookmark.id,
  title: xss(bookmark.title),
  url: bookmark.url,
  description: xss(bookmark.description),
  rating: Number(bookmark.rating),
});

bookmarkRouter
  .route('/bookmarks')
  .get((req, res, next)=>{
    bookmarksService.getAllBookmarks(req.app.get('db'))
      .then(bookmarks => {
        res.json(bookmarks.map(serializeBookmark));
      })
      .catch(next);
  })
  .post(bodyParser, (req, res, next)=>{
    for( const field of ['title', 'url', 'rating']) {
      if(!req.body[field]) {
        logger.error(`${field} is required`);
        return res.status(400).send({
          error: { message: `${field} is required` }
        });
      }
    }
    
    const { title, url, description, rating } = req.body;

    const ratingNum = Number(rating);

    if (!Number.isInteger(ratingNum) || ratingNum < 0 || ratingNum > 5){
      logger.error(`Invalid rating '${rating}' supplied`);
      return res.status(400).send({
        error: { message: '\'rating\' must be a number between 0 and 5' }
      });
    }

    const newBookmark = {
      title,
      url,
      description,
      rating
    };

    bookmarksService.insertBookmark(
      req.app.get('db'),
      newBookmark
    )
      .then(bookmark => {
        logger.info(`Card with id ${bookmark.id} created.`);
        res
          .status(201)
          .location(`/bookmarks/${bookmark.id}`)
          .json(serializeBookmark(bookmark));
      })
      .catch(next);
  });

bookmarkRouter 
  .route('/bookmarks/:bookmark_id')
  .all((req, res, next) => {
    const { bookmark_id } = req.params;
    bookmarksService.getById(req.app.get('db'), bookmark_id)
      .then(bookmark => {
        if (!bookmark) {
          logger.error(`Bookmark with id ${bookmark_id} not found.`);
          return res.status(404).json({
            error: { message: 'Bookmark Not Found' }
          });
        }
        res.bookmark = bookmark;
        next();
      })
      .catch(next);
  })
  
  .get((req, res) => {
    res.json(serializeBookmark(res.bookmark));
  })

  .delete((req, res, next) => {
    // TODO: update to use db
    const { bookmark_id } = req.params;
    bookmarksService.deleteBookmark(
      req.app.get('db'),
      bookmark_id
    )
      .then(numRowsAffected => {
        logger.info(`Card with id ${bookmark_id} deleted.`);
        res.status(204).end();
      })
      .catch(next);
  });

module.exports = bookmarkRouter;