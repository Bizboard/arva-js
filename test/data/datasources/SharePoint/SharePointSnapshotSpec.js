/**
 * Created by lundfall on 3/24/16.
 */


import chai                         from 'chai';
import {loadDependencies,
    mockDependency}                 from '../../../meta/TestBootstrap.js';

let should = chai.should();

describe('SharePointSnapshot', () => {
    let imports = {};

    before(() => {

        return loadDependencies({
            SharePointSnapshot: System.normalizeSync('./src/data/datasources/SharePoint/SharePointSnapshot.js')
        }).then((importedObjects) => {
            imports = importedObjects;
        });
    });

    describe('#constructor', () => {
        it('constructs without exceptions', () => {
            let instance = new imports.SharePointSnapshot('', {});
            should.exist(instance);
        });
    });
});