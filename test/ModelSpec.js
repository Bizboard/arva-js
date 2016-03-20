import chai                         from 'chai';
import {loadDependencies}           from './TestBootstrap.js';

let should = chai.should();

describe('Model', () => {
    let imports = {};

    before(() => {
        return loadDependencies({
            Model: System.normalizeSync('./src/core/Model.js')
        }).then((importedObjects) => {
            imports = importedObjects;
        });
    });

    describe('#constructor', () => {
        it('constructs without exceptions', () => {
            let instance = new imports.Model('1', null, {dataSource: {once: () => {}}});
            should.exist(instance);
        });
    });
});