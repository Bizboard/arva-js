import chai                         from 'chai';
import {loadDependencies}           from './TestBootstrap.js';

let should = chai.should();

describe('DataModelGenerator', () => {
    let imports = {};

    before(() => {
        return loadDependencies({
            DataModelGenerator: System.normalizeSync('./src/data/datasources/SharePoint/DataModelGenerator.js')
        }).then((importedObjects) => {
            imports = importedObjects;
        });
    });

    describe('#constructor', () => {
        it('constructs without exceptions', () => {
            let instance = new imports.DataModelGenerator('', {});
            should.exist(instance);
        });
    });
});