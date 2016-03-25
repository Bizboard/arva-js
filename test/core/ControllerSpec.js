import chai                         from 'chai';
import {loadDependencies}           from '../meta/TestBootstrap.js';

let should = chai.should();

describe('Controller', () => {
    let imports = {};

    before(() => {
        /* Mock famous-flex's FlexScrollView so no attempt to insert anything into the DOM is made. */
        System.delete(System.normalizeSync('famous-flex/AnimationController.js'));
        System.set(System.normalizeSync('famous-flex/AnimationController.js'), System.newModule({default: function () { this.options = {}; }}));

        return loadDependencies({
            Controller: System.normalizeSync('./src/core/Controller.js')
        }).then((importedObjects) => {
            imports = importedObjects;
        });
    });

    after(() => {
        System.delete(System.normalizeSync('famous-flex/AnimationController.js'));
    });

    describe('#constructor', () => {
        it('constructs without exceptions', () => {
            let instance = new imports.Controller({add: () => {}});
            should.exist(instance);
        });
    });
});