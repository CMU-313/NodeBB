'use strict';


const assert = require('assert');
const pagination = require('../src/pagination');

describe('Pagination', () => {
    it('should create empty pagination for 1 page', (done) => {
        const data = pagination.create(1, 1);
        assert.equal(data.pages.length, 0);
        assert.equal(data.rel.length, 0);
        assert.equal(data.pageCount, 1);
        assert.equal(data.currentPage, 1); // edit
        assert.equal(data.first.page, 1); // edit
        assert.equal(data.last.page, 1); // edit
        assert.equal(data.prev.page, 1);
        assert.equal(data.next.page, 1);
        done();
    });

    it('should create pagination for 10 pages', (done) => {
        const data = pagination.create(2, 10);
        // [1, (2), 3, 4, 5, separator, 9, 10]
        assert.equal(data.pages.length, 8);
        assert.equal(data.rel.length, 2);
        assert.equal(data.pageCount, 10);
        assert.equal(data.first.page, 1); // edit
        assert.equal(data.last.page, 10); // edit
        assert.equal(data.currentPage, 2); // edit
        assert.equal(data.prev.page, 1); // edit
        assert.equal(data.next.page, 3);
        done();
    });

    // I don't understand querys I'm sorry
    it('should create pagination for 3 pages with query params', (done) => {
        const data = pagination.create(1, 3, { key: 'value' });
        assert.equal(data.pages.length, 3);
        assert.equal(data.rel.length, 1);
        assert.equal(data.pageCount, 3);
        assert.equal(data.prev.page, 1);
        assert.equal(data.next.page, 2);
        assert.equal(data.pages[0].qs, 'key=value&page=1');
        done();
    });

    // additional tests for 'faulty' cases:
    it('should create pagination for same start/end pages', (done) => {
        const data = pagination.create(8, 8);
        assert.equal(data.pages.length, 8);
        assert.equal(data.rel.length, 1);
        assert.equal(data.pageCount, 8);
        assert.equal(data.currentPage, 8);
        assert.equal(data.first.page, 1);
        assert.equal(data.last.page, 8);
        assert.equal(data.prev.page, 7);
        assert.equal(data.next.page, 8);
        done();
    });

    it('should create pagination for 0 pages', (done) => {
        const data = pagination.create(1, 0);
        assert.equal(data.pages.length, 0);
        assert.equal(data.rel.length, 0);
        assert.equal(data.pageCount, 1);
        assert.equal(data.currentPage, 1);
        assert.equal(data.first.page, 1);
        assert.equal(data.last.page, 1);
        assert.equal(data.prev.page, 1);
        assert.equal(data.next.page, 1);
        done();
    });

    it('should create pagination for faulty bounds', (done) => {
        const data = pagination.create(8, 4);
        assert.equal(data.pages.length, 4);
        assert.equal(data.rel.length, 1);
        assert.equal(data.pageCount, 4);
        assert.equal(data.currentPage, 8);
        assert.equal(data.first.page, 1);
        assert.equal(data.last.page, 4);
        assert.equal(data.prev.page, 7);
        assert.equal(data.next.page, 4);
        done();
    });
});
