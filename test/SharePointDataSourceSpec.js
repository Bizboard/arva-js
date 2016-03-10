/**
 * Created by tom on 23/10/15.
 */

import chai                         from 'chai';
import {loadDependencies}           from './TestBootstrap.js';

let should = chai.should();

describe('SharePointDataSource', () => {
    let imports = {};

    before(() => {
        /* Mock web workers for the SharePoint client if we're running tests from nodejs */
        if(typeof Worker === 'undefined') { global.Worker = class Worker { postMessage () {} }; }

        return loadDependencies({SharePointDataSource: './src/data/datasources/SharePointDataSource.js'}).then((importedObjects) => { imports = importedObjects; });
    });

    describe('#constructor', () => {
        it('builds a dataReference when given a path', () => {
            let dataSource = new imports.SharePointDataSource('http://somedomain.org/site/list');
            should.exist(dataSource._dataReference);
        });
        it('does not build a dataReference when only a site is given', () => {
            let dataSource = new imports.SharePointDataSource('http://somedomain.org/site/');
            should.not.exist(dataSource._dataReference);
        });
        it('saves its options correctly', () => {
            let query = {1:1};
            let orderBy = 'id';
            let limit = 100;
            let dataSource = new imports.SharePointDataSource('http://somedomain.org/site/', {query:query, orderBy, limit});
            dataSource.options.query.should.deep.equal(query);
            dataSource.options.orderBy.should.equal(orderBy);
            dataSource.options.limit.should.equal(limit);
        });
    });

    describe('#events', () => {
        it('calls setValueChangedCallback callback immediately after push', () => {
            let dataSource = new imports.SharePointDataSource('http://somedomain.org/site/List');
            let check = null;
            let childRef = dataSource.push({test:true});
            childRef.setValueChangedCallback(() => {
                check = 'pass';
            });
            if(check === null) { check = 'fail'; }
            check.should.equal('pass');
        });
        it('calls setValueChangedCallback callback immediately after set', () => {
            let dataSource = new imports.SharePointDataSource('http://somedomain.org/site/List/1');
            let check = null;
            dataSource.set({test:true});
            dataSource.setValueChangedCallback(() => {
                check = 'pass';
            });
            if(check === null) { check = 'fail'; }
            check.should.equal('pass');
        });
        it('triggers the callback in once() exactly one time after calling set(), even if another set() is done afterwards', () => {
            let dataSource = new imports.SharePointDataSource('http://somedomain.org/site/List/1');
            let amountCalled = 0;
            dataSource.set({test1:true});
            dataSource.once('value', () => {
                amountCalled++;
            });
            dataSource.set({test2:true});
            amountCalled.should.equal(1);
        });
        it('properly removes callbacks upon calling off() without specifying event type', () => {
            let dataSource = new imports.SharePointDataSource('http://somedomain.org/site/List/1');
            let amountCalled = 0;
            dataSource.once('value', () => {
                amountCalled++;
            });
            dataSource.off();
            dataSource.set({test:true});
            amountCalled.should.equal(0);
        });
    });
});