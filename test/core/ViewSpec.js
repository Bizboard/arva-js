import _                            from 'lodash';
import chai                         from 'chai';
import sinon                        from 'sinon';
import {mockDOMGlobals, loadDependencies, restoreDOMGlobals,
    mockDependency}                 from '../meta/TestBootstrap.js';
import requestAnimationFrame        from 'request-animation-frame-mock';

let should = chai.should();
let imports = {};

let fakeCommit = (view)=> {
    view.layout.commit({size: [100, 100]});
};

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
    should.not.exist(instance.layout.getDataSource());
    fakeCommit(instance);
    Object.keys(instance.layout.getDataSource()).length.should.equal(2);
    return instance;
};

describe('View', () => {

    before(async function () {
        mockDependency('famous/surfaces/ImageSurface.js');
        mockDependency('famous/core/ContainerSurface.js');

        mockDOMGlobals();
        let ElementOutput = await System.import('famous/core/ElementOutput');
        //Mock for the Famous Surface
        mockDependency('./ElementOutput.js', ElementOutput);

        mockDependency('famous/core/Group.js');
        mockDependency('famous/utilities/Timer.js');
        mockDependency('famous-flex/LayoutUtility.js', {registerHelper: new Function()});
        mockDependency('famous-flex/FlexScrollView.js', function () {
            this.options = {};
        });

        return loadDependencies({
            View: System.normalizeSync('./src/core/View.js'),
            decorators: System.normalizeSync('./src/layout/decorators.js'),
            Surface: System.normalizeSync('famous/core/Surface.js'),
            Engine: System.normalizeSync('famous/core/Engine.js'),
            RenderNode: System.normalizeSync('famous/core/RenderNode.js'),
            SpecParser: System.normalizeSync('famous/core/SpecParser.js'),
            Transform: System.normalizeSync('famous/core/Transform.js')
        }).then((importedObjects) => {
            imports = importedObjects;
        });
    });

    after(() => {
        restoreDOMGlobals();
    });

    describe('#constructor', () => {
        it('constructs without exceptions', () => {
            let instance = new imports.View();
            should.exist(instance);
        });


    });

    describe('#renderable creation', () => {

        let createDecoratedView = () => {
            let layout = imports.decorators.layout;
            let {Surface, View} = imports;
            class DecoratedView extends View {
                @layout.dock('top', 50)
                top1 = new Surface({});

                @layout.dock('top', 50)
                top2 = new Surface({});

                @layout.dock('fill')
                fill = new Surface({});

                @layout.size(50, 50)
                @layout.place('center')
                center = new Surface({});

                @layout.renderable
                ignored = new Surface({});

                @layout.fullscreen
                fullscreen = new Surface({});
            }
            return new DecoratedView();
        };

        it('has its children added to the datasource on the first commit', () => {
            addRenderablesTest();
        });


        it('can instantiate children through decorators', () => {
            let instance = createDecoratedView();
            should.exist(instance);
            should.exist(instance.top1);
            should.exist(instance.top2);
            should.exist(instance.fill);
            should.exist(instance.center);
            should.exist(instance.ignored);
            should.exist(instance.fullscreen);

            should.exist(instance.decoratedRenderables['top1']);
            should.exist(instance.decoratedRenderables['top2']);
            should.exist(instance.decoratedRenderables['fill']);
            should.exist(instance.decoratedRenderables['center']);
            should.exist(instance.decoratedRenderables['ignored']);
            should.exist(instance.decoratedRenderables['fullscreen']);
        });

        it('can create "decorated" renderables at runtime, resulting in the same setup', () => {
            class RunTimeDecoratedView extends imports.View {
            }

            let runTimeDecoratedView = new RunTimeDecoratedView();
            let decoratedView = createDecoratedView();
            runTimeDecoratedView.addRenderable(decoratedView.top1, 'top1', imports.decorators.layout.dock('top', 50));
            runTimeDecoratedView.addRenderable(decoratedView.top2, 'top2', imports.decorators.layout.dock('top', 50));
            runTimeDecoratedView.addRenderable(decoratedView.fill, 'fill', imports.decorators.layout.dock('fill'));
            runTimeDecoratedView.addRenderable(decoratedView.center, 'center', imports.decorators.layout.size(50, 50), imports.decorators.layout.place('center'));
            runTimeDecoratedView.addRenderable(decoratedView.ignored, 'ignored', imports.decorators.layout.renderable);
            runTimeDecoratedView.addRenderable(decoratedView.fullscreen, 'fullscreen', imports.decorators.layout.fullscreen);
            decoratedView.renderables.should.deep.equal(runTimeDecoratedView.renderables);
        });

        it('correctly groups decorated renderables', () => {
            let decoratedView = createDecoratedView();
            decoratedView._groupedRenderables.should.include.keys('docked');
            decoratedView._groupedRenderables.should.include.keys('filled');
            decoratedView._groupedRenderables.should.include.keys('traditional');
            decoratedView._groupedRenderables.should.include.keys('ignored');
            decoratedView._groupedRenderables.should.include.keys('fullscreen');

            decoratedView._groupedRenderables.docked.keys().should.deep.equal(['top1', 'top2']);
            decoratedView._groupedRenderables.filled.keys().should.deep.equal(['fill']);
            decoratedView._groupedRenderables.traditional.keys().should.deep.equal(['center']);
            decoratedView._groupedRenderables.ignored.keys().should.deep.equal(['ignored']);
            decoratedView._groupedRenderables.fullscreen.keys().should.deep.equal(['fullscreen']);
        });

        it('allows manipulation of the rendering order of renderables', () => {
            let decoratedView = createDecoratedView();
            decoratedView._groupedRenderables.should.include.keys('docked');
            
            decoratedView.prioritiseDockBefore('top2', 'top1').should.be.ok;

            decoratedView._groupedRenderables.docked.keys().should.deep.equal(['top2', 'top1']);
        });
    });

    describe('#piping', () => {
        it('has children which pipe to the view', () => {
            let instance = addRenderablesTest();
            let eventCallback = sinon.spy();
            instance.on('customEvent', eventCallback);
            instance.renderables.surface1._eventOutput.emit('customEvent');
            instance.renderables.surface2._eventOutput.emit('customEvent');
            eventCallback.calledTwice.should.be.ok;
        });
        it('has recursive reflows that propagate upwards', () => {
            class MyView1 extends imports.View {
            }
            
            class MyView2 extends imports.View {
                @imports.decorators.layout.dock('top', 50)
                inside = new MyView1();
            }
            let parentView = new MyView2();
            fakeCommit(parentView);
            let parentReflow = sinon.spy(parentView.layout, 'reflowLayout');
            let childReflow = sinon.spy(parentView.inside.layout, 'reflowLayout');
            parentView.inside.reflowRecursively();
            parentReflow.calledOnce.should.be.ok;
            childReflow.calledOnce.should.be.ok;
        });
    });

    describe('#sizing', () => {
        it('adapts is size to a single placed renderable', () => {
            class SimpleView extends imports.View {
                @imports.decorators.layout.size(100,100)
                a = new imports.Surface();
            }
            new SimpleView().getSize().should.deep.equal([100,100]);
        });

        it('adapts is size to bound two renderables', () => {
            class TwoNodesView extends imports.View {
                @imports.decorators.layout.size(100,100)
                a = new imports.Surface();

                @imports.decorators.layout.size(80,200)
                b = new imports.Surface();
            }
            new TwoNodesView().getSize().should.deep.equal([100,200]);
        });

        it('adapts is size to a displaced renderable', () => {
            class DisplacedView extends imports.View {
                @imports.decorators.layout.size(100,100)
                a = new imports.Surface();

                @imports.decorators.layout.size(100,100)
                @imports.decorators.layout.translate(0,10,0)
                b = new imports.Surface();
            }
            new DisplacedView().getSize().should.deep.equal([100,110]);
        });

        for (let direction of ['top', 'bottom', 'left', 'right']) {
            let isVerticalDirection = !!~['top', 'bottom'].indexOf(direction);
            it(`sizes automatically when stacked in direction ${direction}`, () => {
                class StackedView extends imports.View {
                    @imports.decorators.layout.dock(direction, 50)
                    a = new imports.Surface();
                    @imports.decorators.layout.dock(direction, 50)
                    b = new imports.Surface();
                    @imports.decorators.layout.dock(direction, 50)
                    c = new imports.Surface();
                }
                new StackedView().getSize().should.deep.equal(isVerticalDirection ? [undefined, 150] : [150, undefined]);
            });
            it(`calculates the bounding box when stacked in direction ${direction}, also when the other dimension is specified`, () => {
                class StackedView extends imports.View {
                    @imports.decorators.layout.size(...(isVerticalDirection ? [40, 50] : [50, 40]))
                    @imports.decorators.layout.dock(direction)
                    a = new imports.Surface();
                    @imports.decorators.layout.size(...(isVerticalDirection ? [30, 50] : [50, 30]))
                    @imports.decorators.layout.dock(direction)
                    b = new imports.Surface();
                    @imports.decorators.layout.size(50, 50)
                    @imports.decorators.layout.dock(direction)
                    c = new imports.Surface();
                }
                new StackedView().getSize().should.deep.equal(isVerticalDirection ? [50, 150] : [150, 50]);
            });
            it(`can also let the fill determine the size in other dimension of ${direction}`, () => {
                class StackedView extends imports.View {
                    @imports.decorators.layout.dock(direction, 50)
                    a = new imports.Surface();
                    @imports.decorators.layout.size(...(isVerticalDirection ? [400, undefined] : [undefined, 400]))
                    @imports.decorators.layout.dock('fill')
                    b = new imports.Surface();
                }
                new StackedView().getSize().should.deep.equal(isVerticalDirection ? [400, undefined] : [undefined, 400]);
            });
        }

        it('handles a difficult sizing situation', () => {
            class DifficultView extends imports.View {
                @imports.decorators.layout.size(100,100)
                @imports.decorators.layout.dock('top')
                a = new imports.Surface();

                @imports.decorators.layout.size(100,100)
                @imports.decorators.layout.dock('bottom')
                b = new imports.Surface();

                @imports.decorators.layout.size(70,300)
                @imports.decorators.layout.translate(50,10,0)
                c = new imports.Surface();
            }
            new DifficultView().getSize().should.deep.equal([120,undefined]);
        });
    });
    
    describe('#performance', () => {

        let decorateApplyCommit = (extraFn) => {
            /* Spec parser is called every time _applyCommit is called, so we will decorate this one */
            let oldSpecParserFn = imports.SpecParser.parse;
            imports.SpecParser.parse = function () {
                extraFn(...arguments);
                return oldSpecParserFn.apply(this, arguments);
            }

        };

        let setupPerformanceExperiment = (done, loopFn) => {
            let context = imports.Engine.createContext({style: {}, appendChild: new Function()});
            requestAnimationFrame.setMode(requestAnimationFrame.modes.MANUAL);
            class SubSubView extends imports.View {
                @imports.decorators.layout.dock('top', 50)
                renderable1 = new imports.Surface();
                @imports.decorators.layout.dock('top', 50)
                renderable2 = new imports.Surface();
            }

            class SubView extends imports.View {
                @imports.decorators.layout.dock('top', 50)
                subView = new SubSubView();
                @imports.decorators.layout.dock('top', 50)
                renderable = new imports.Surface();
            }

            class MyView extends imports.View {
                @imports.decorators.layout.dock('top', 50)
                subView = new SubView();
                @imports.decorators.layout.dock('top', 50)
                subView2 = new SubView();
                @imports.decorators.layout.dock('top', 50)
                subsubView = new SubSubView();
                @imports.decorators.layout.dock('top', 50)
                renderable = new imports.Surface();
            }
            let myView = new MyView();
            context.add(myView);


            let i = 0;
            let animationFrames = 15;
            let loop = () => {
                if (i < animationFrames) {
                    requestAnimationFrame.mock.requestAnimationFrame(loop);
                    loopFn(i);
                    i++;
                    requestAnimationFrame.trigger(0);
                } else {

                    done();
                }
            };
            requestAnimationFrame.mock.requestAnimationFrame(loop);
            requestAnimationFrame.trigger(0);
        };

        it('causes the applyCommit function to be called once more per requestAnimationFrame for every view int the chain', (done) => {
            let nApplyCommitCalled = 0;
            decorateApplyCommit(() => nApplyCommitCalled++);
            setupPerformanceExperiment(done, (i) => {
                /* Views get added as the commits go by. First loop we have only 2 commits, because only
                 the root and the first view is present. Secondly, three views gets added that are children of
                 "MyView". Then, two children of the children can also add their children, making a total of 7
                 */
                let expectedTimesCalled = 7;
                if (i === 0) {
                    expectedTimesCalled = 2;
                } else if (i === 1) {
                    expectedTimesCalled = 5;
                }
                nApplyCommitCalled.should.equal(expectedTimesCalled);
                nApplyCommitCalled = 0;

            })
        });

        it('causes 40 matrix transformations or less to be executed in above experiment', (done) => {
            let spy = sinon.spy(imports.Transform,'multiply');
            setupPerformanceExperiment(done, (i) => {
                let expectedCount = 40;
                if (i == 0) {
                    expectedCount = 21
                } else if (i == 1) {
                    expectedCount = 28;
                } else if (i === 2) {
                    expectedCount = 36
                }
                spy.callCount.should.equal(expectedCount);
                spy.reset();
            });
        });
    });
});