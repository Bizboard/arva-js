import chai                         from 'chai';
import sinon                        from 'sinon';
import {loadDependencies,
    mockDependency}                 from '../meta/TestBootstrap.js';

let should = chai.should();

describe('View', () => {
    let imports = {};

    before(() => {
        mockDependency('famous/core/Surface.js');
        mockDependency('famous/surfaces/ImageSurface.js');
        mockDependency('famous/core/ContainerSurface.js');
        mockDependency('famous/core/ElementOutput.js');
        mockDependency('famous/core/Group.js');
        mockDependency('famous/core/Engine.js');
        mockDependency('famous-flex/LayoutUtility.js');
        mockDependency('famous/core/View.js', function() {
            this.options = {};
            this._eventInput = { on: sinon.stub() };
            this.add = sinon.stub();
        });
        mockDependency('famous-flex/LayoutController.js', function() {
            this.add = sinon.stub();
            this.pipe = sinon.stub();
        });
        mockDependency('famous-flex/FlexScrollView.js', function() {
            this.options = {};
        });

        return loadDependencies({
            View: System.normalizeSync('./src/core/View.js')
        }).then((importedObjects) => {
            imports = importedObjects;
        });
    });

    describe('#constructor', () => {
        it('constructs without exceptions', () => {
            let instance = new imports.View();
            should.exist(instance);
        });
    });
});