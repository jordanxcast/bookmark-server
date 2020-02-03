/* eslint-disable quotes */
const knex = require('knex');
const app = require('../src/app');
const { makeBookmarksArray, makeMaliciousBookmark } = require('./bookmarks.fixtures');

describe('Bookmarks Endpoints', () => {
  let db;

  before('make knex instance', () => {
    db = knex({
      client: 'pg',
      connection: process.env.TEST_DB_URL,
    });
    app.set('db', db);
  });

  after('disconnect from db', () => db.destroy());

  before('clean the table', () => db('bookmarks').truncate());

  afterEach('cleanup', () => db('bookmarks').truncate());

  describe('Unauthorized requests', () => {
    const testBookmarks = makeBookmarksArray();

    beforeEach('insert bookmarks', () => {
      return db
        .into('bookmarks')
        .insert(testBookmarks);
    });

    it('responds with 401 Unauthorized for GET /api/bookmarks', () => {
      return supertest(app)
        .get('/api/bookmarks')
        .expect(401, { error: 'Unauthorized request' });
    });

    it('responds with 401 Unauthorized for POST /api/bookmarks', () => {
      return supertest(app)
        .post('/api/bookmarks')
        .send({ title: 'test-title', url: 'http://some.thing.com', rating: 1 })
        .expect(401, { error: 'Unauthorized request' });
    });

    it('responds with 401 Unauthorized for GET /api/bookmarks/:id', () => {
      const secondBookmark = testBookmarks[1];
      return supertest(app)
        .get(`/api/bookmarks/${secondBookmark.id}`)
        .expect(401, { error: 'Unauthorized request' });
    });

    it('responds with 401 Unauthorized for DELETE /api/bookmarks/:id', () => {
      const bookmarkToDelete = testBookmarks[1];
      return supertest(app)
        .delete(`/api/bookmarks/${bookmarkToDelete.id}`)
        .expect(401, { error: 'Unauthorized request' });
    });
  });

  describe('GET /api/bookmarks', () => {
    context('Given no bookmarks in the database', () => {
      it('responds with 200 and an empty array', () => {
        return supertest(app)
          .get('/api/bookmarks')
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .expect(200, []);
      });
    });

    context('Given there are bookmarks in the database', () => {
      const testBookmarks = makeBookmarksArray();
  
      beforeEach('insert bookmarks', () => {
        return db
          .into('bookmarks')
          .insert(testBookmarks);
      });
  
      it('GET /api/bookmarks from the store', () => {
        return supertest(app)
          .get('/api/bookmarks')
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .expect(200, testBookmarks);
      });
    });

    context('Given an XSS attack bookmark', () => {
      const { maliciousBookmark, expectedBookmark } = makeMaliciousBookmark();

      beforeEach('insert malicious bookmark', () => {
        return db
          .into('bookmarks')
          .insert([maliciousBookmark]);
      });

      it('removes XSS attack content', () => {
        return supertest(app)
          .get('/api/bookmarks')
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .expect(200)
          .expect(res => {
            expect(res.body[0].title).to.eql(expectedBookmark.title);
            expect(res.body[0].description).to.eql(expectedBookmark.description);
          });
      });
    });
  });
  
  describe('GET /api/bookmarks/:bookmark_id', () => {
    context('Given no bookmarks', () => {
      it('responds with 404 when bookmark doesn\'t exist', () => {
        const bookmarkId= 123456;
        return supertest(app)
          .get(`/api/bookmarks/${bookmarkId}`)
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .expect(404, { 
            error: { message: 'Bookmark Not Found'}
          });
      });
    });

    context('Given there are bookmakrs in the database', () => {
      const testBookmarks = makeBookmarksArray();
  
      beforeEach('insert bookmarks', () => {
        return db
          .into('bookmarks')
          .insert(testBookmarks);
      });

      it('responds with 200 and the specified bookmark', () => {
        const bookmarkId = 2;
        const expectedBookmark = testBookmarks[bookmarkId - 1];
        return supertest(app)
          .get(`/api/bookmarks/${bookmarkId}`)
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .expect(200, expectedBookmark);
      });
    });

    context('Given an XSS attack bookmark', () => {
      const { maliciousBookmark, expectedBookmark } = makeMaliciousBookmark();

      beforeEach('insert malicious bookmark', () => {
        return db
          .into('bookmarks')
          .insert([maliciousBookmark]);
      });

      it('removes XSS attack content', () => {
        return supertest(app)
          .get(`/api/bookmarks/${maliciousBookmark.id}`)
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .expect(200)
          .expect(res => {
            expect(res.body.title).to.eql(expectedBookmark.title);
            expect(res.body.description).to.eql(expectedBookmark.description);
          });
      });
    });
  });

  describe('DELETE /api/bookmarks/:id', () => {
    context('Given no bookmarks', () => {
      it('responds 404 whe bookmark doesn\'t exist', () => {
        return supertest(app)
          .delete('/api/bookmarks/123')
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .expect(404, {
            error: { message: 'Bookmark Not Found' }
          });
      });
    });

    context('Given there are bookmarks in the database', () => {
      const testBookmarks = makeBookmarksArray();

      beforeEach('insert bookmarks', () => {
        return db
          .into('bookmarks')
          .insert(testBookmarks);
      });

      it('removes the bookmark by ID from the store', () => {
        const idToRemove = 2;
        const expectedBookmarks = testBookmarks.filter(bm => bm.id !== idToRemove);
        return supertest(app)
          .delete(`/api/bookmarks/${idToRemove}`)
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .expect(204)
          .then(() =>
            supertest(app)
              .get('/api/bookmarks')
              .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
              .expect(expectedBookmarks)
          );
      });
    });
  });

  describe('POST /api/bookmarks', () => {
    
    const requiredFields = ['title', 'url', 'rating'];

    requiredFields.forEach(field => {
      const newTestBookmark = {
        'title': 'A test title',
        'url': 'https://www.testsite.com',
        'rating': 3
      };

      it('Responds with 400 missing [field] ', () => {
        delete newTestBookmark[field];
        return supertest(app)
          .post('/api/bookmarks')
          .send(newTestBookmark)
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .expect(400, {
            error: {message: `${field} is required`}
          });
      }); 
    });

    it('Responds with "rating must be between 0 and 5" if rating is outside the range', () => {
      const newBookmarkInvalidRating = {
        'title': 'Parry Hotter',
        'url': 'www.parryhotter.com',
        'rating': 87
      };

      return supertest(app)
        .post('/api/bookmarks')
        .send(newBookmarkInvalidRating)
        .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
        .expect(400, `'rating' must be a number between 0 and 5`);
        
    });

    it(`Responds 'url' must be a valid url when given an invalid one`, () => {
      const newBookmarkBadBadUrl = {
        'title': 'A test title',
        'url': 'nope.nope.com',
        'rating': 3
      };

      supertest(app)
        .post('/api/bookmarks')
        .send(newBookmarkBadBadUrl)
        .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
        .expect(400, `'url' must be a valid URL`);
    });

    it('creates a bookmark, responding with 201 and the new bookmark', () => {
      const newBookmark = {
        title: 'Test new bookmarks',
        url: 'https://www.zillow.com',
        description: 'New bookmarks description',
        rating: 5
      };

      return supertest(app)
        .post('/api/bookmarks')
        .send(newBookmark)
        .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
        .expect(201)
        .expect(res => {
          expect(res.body.title).to.eql(newBookmark.title);
          expect(res.body.url).to.eql(newBookmark.url);
          expect(res.body.description).to.eql(newBookmark.description);
          expect(res.body.rating).to.eql(newBookmark.rating);
          expect(res.body).to.have.property('id');
        })
        .then(postRes => 
          supertest(app)
            .get(`/api/bookmarks/${postRes.body.id}`)
            .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
            .expect(postRes.body)  
        );

    });

    it('removes XSS evilness from response', () => {
      const { maliciousBookmark, expectedBookmark } = makeMaliciousBookmark();
      return supertest(app)
        .post(`/api/bookmarks`)
        .send(maliciousBookmark)
        .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
        .expect(201)
        .expect(res => {
          expect(res.body.title).to.eql(expectedBookmark.title);
          expect(res.body.description).to.eql(expectedBookmark.description);
        });

    });


  });
});
