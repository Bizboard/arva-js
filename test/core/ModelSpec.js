import chai                         from 'chai';
import {loadDependencies,
    mockDependency}
                                    from '../meta/TestBootstrap.js';

let should = chai.should();

describe('Model', () => {
    let imports = {};

    before(() => {
        mockDependency('./src/utils/Context.js', {
            Context: {
                getContext: () => ({
                    'get': () => ({child: () => ({once: () => 0})})
                })
            }
        });

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