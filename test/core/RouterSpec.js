import chai                         from 'chai';
import {loadDependencies}           from '../meta/TestBootstrap.js';

let should = chai.should();

describe('Router', () => {
    let imports = {};

    before(() => {
        return loadDependencies({
            Router: System.normalizeSync('./src/core/Router.js')
        }).then((importedObjects) => {
            imports = importedObjects;
        });
    });

    describe('#constructor', () => {
        it('constructs without exceptions', () => {
            let instance = new imports.Router();
            should.exist(instance);
        });
    });
});