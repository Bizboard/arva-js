import chai                         from 'chai';
import sinon                        from 'sinon';
import {loadDependencies}           from '../meta/TestBootstrap.js';

let should = chai.should();

describe('View', () => {
    let imports = {};

    before(() => {
        System.delete(System.normalizeSync('famous/core/Surface.js'));
        System.set(System.normalizeSync('famous/core/Surface.js'), System.newModule({ default: sinon.stub().returns({}) }));

        System.delete(System.normalizeSync('famous/surfaces/ImageSurface.js'));
        System.set(System.normalizeSync('famous/surfaces/ImageSurface.js'), System.newModule({ default: sinon.stub().returns({}) }));

        System.delete(System.normalizeSync('famous/surfaces/ContainerSurface.js'));
        System.set(System.normalizeSync('famous/surfaces/ContainerSurface.js'), System.newModule({ default: sinon.stub().returns({}) }));

        System.delete(System.normalizeSync('famous/core/ElementOutput.js'));
        System.set(System.normalizeSync('famous/core/ElementOutput.js'), System.newModule({ default: sinon.stub().returns({}) }));

        System.delete(System.normalizeSync('famous/core/Group.js'));
        System.set(System.normalizeSync('famous/core/Group.js'), System.newModule({ default: sinon.stub().returns({}) }));

        System.delete(System.normalizeSync('famous/core/Engine.js'));
        System.set(System.normalizeSync('famous/core/Engine.js'), System.newModule({ default: sinon.stub().returns({}) }));

        System.delete(System.normalizeSync('famous-flex/LayoutUtility'));
        System.set(System.normalizeSync('famous-flex/LayoutUtility.js'), System.newModule({ default: sinon.stub().returns({}) }));

        System.delete(System.normalizeSync('famous/core/View.js'));
        System.set(System.normalizeSync('famous/core/View.js'), System.newModule({ default: function(){
            this.options = {};
            this._eventInput = { on: sinon.stub() };
            this.add = sinon.stub();
        } }));

        System.delete(System.normalizeSync('famous-flex/LayoutController.js'));
        System.set(System.normalizeSync('famous-flex/LayoutController.js'), System.newModule({ default: function(){
            this.add = sinon.stub();
            this.pipe = sinon.stub();
        } }));

        System.delete(System.normalizeSync('famous-flex/FlexScrollView.js'));
        System.set(System.normalizeSync('famous-flex/FlexScrollView.js'), System.newModule({default: function () { this.options = {}; }}));

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