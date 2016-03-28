import chai                         from 'chai';
import sinon                        from 'sinon';
import {loadDependencies,
    mockDependency}                 from '../meta/TestBootstrap.js';

let should = chai.should();
let expect = chai.expect;

describe('View', () => {
    let imports = {};

    before( async function()  {
        mockDependency('famous/surfaces/ImageSurface.js');
        mockDependency('famous/core/ContainerSurface.js');

        if(global) {
            global['document'] = {documentElement: {style: {}}};
            global['window'] = {};
        }
        let ElementOutput = await System.import('famous/core/ElementOutput');
        //Mock for the Famous Surface
        mockDependency('./ElementOutput.js', ElementOutput);

        mockDependency('famous/core/Group.js');
        mockDependency('famous/core/Engine.js');
        mockDependency('famous-flex/LayoutUtility.js', {registerHelper: new Function()});
        mockDependency('famous-flex/FlexScrollView.js', function() {
            this.options = {};
        });

        return loadDependencies({
            View: System.normalizeSync('./src/core/View.js'),
            Surface: System.normalizeSync('famous/core/Surface.js')
        }).then((importedObjects) => {
            imports = importedObjects;
        });
    });

    after(() => {
        if(global && (global['window'] || global['document'])) {
            delete global['document'];
            delete global['window'];
        }
    });

    describe('#constructor', () => {
        it('constructs without exceptions', () => {
            let instance = new imports.View();
            should.exist(instance);
        });

        let addRenderablesTest = () => {

            class MyView extends imports.View {
                constructor() {
                    super();
                    this.renderables = {
                        surface1: new imports.Surface(),
                        surface2: new imports.Surface()
                    }
                }
            }
            let instance = new MyView();
            expect(instance.layout.getDataSource()).to.not.exist;
            instance.layout.commit({size: [100, 100]});
            expect(Object.keys(instance.layout.getDataSource()).length).to.equal(2);
            return instance;
        };

        it('has children which are added to the datasource on the first commit', () => {
            addRenderablesTest();
        });
        it('has children which pipes to the view', () => {
            let instance = addRenderablesTest();
            let eventCallback = sinon.spy();
            instance.on('customEvent', eventCallback);
            instance.renderables.surface1._eventOutput.emit('customEvent');
            instance.renderables.surface2._eventOutput.emit('customEvent');
            expect(eventCallback.calledTwice).to.be.true;
        });
    });

});