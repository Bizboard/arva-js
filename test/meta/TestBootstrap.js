/**
 * Created by tom on 23/10/15.
 */

import 'babel-polyfill';
import sinon                    from 'sinon';
import mockBrowser              from 'mock-browser';
import requestAnimationFrame    from 'request-animation-frame-mock';

let onSystemReady = SystemJS.import('./test/meta/DummyFile.js');

export function mockDependency(dependency, replacement) {

    if (!replacement) {
        replacement = sinon.stub();
    }
    if (typeof replacement === 'function') {
        replacement = {default: replacement};
    }

    SystemJS.delete(SystemJS.normalizeSync(dependency));
    SystemJS.set(SystemJS.normalizeSync(dependency), SystemJS.newModule(replacement));
}

export async function mockArvaViewDependencies() {
    mockDependency('famous/surfaces/ImageSurface.js');
    mockDependency('famous/Surfaces/ContainerSurface.js', () => ({add: () => {}}));
    mockDependency('famous/core/Engine.js', { default: class Engine { static createContext(){} } } );
    mockDependency('famous/core/Context.js', () => ({add: () => {}}) );
    mockDependency('css', {fetch: () => 'export default "";'});

    await mockDOMGlobals();
    let ElementOutput = await SystemJS.import('famous/core/ElementOutput.js');
    let Decorators = await SystemJS.import('arva-js/layout/decorators.js');
    Decorators.layout.margins = () => (() => {});

    //Mock for the Famous Surface
    mockDependency('./ElementOutput.js', ElementOutput);
    mockDependency('famous/core/Group.js');
    mockDependency('famous/utilities/Timer.js');
    mockDependency('arva-js/layout/decorators.js', Decorators);
    mockDependency('famous-flex/LayoutUtility.js', { registerHelper: () => {} });
    mockDependency('famous-flex/FlexScrollView.js', () => ({ options: {} }));
    mockDependency('famous-flex/ScrollController.js', () => ({ pipe: () => {} }));
}

export function restoreDependency(dependency) {
    SystemJS.delete(SystemJS.normalizeSync(dependency));
}

export async function mockDOMGlobals() {
    await onSystemReady;
    if (global) {
        let browser = new (mockBrowser.mocks.MockBrowser)();
        global.document = browser.getDocument();
        global.window = browser.getWindow();
        global.window.requestAnimationFrame = requestAnimationFrame.mock.requestAnimationFrame;
        global.location = browser.getLocation();
        global.navigator = browser.getNavigator();
        global.history = browser.getHistory();
        global.Node = sinon.stub();
    }
    else {
        window.Node = sinon.stub();
    }
}


export function restoreDOMGlobals() {
    if (global && (global.window || global.document)) {
        delete global.document;
        delete global.window;
        delete global.history;
        delete global.Node;
    }

}


export function loadDependencies(dependencies) {
    let imports = {};
    let promises = [];

    for (let key in dependencies) {
        let dependencyLocation = dependencies[key];
        promises.push(SystemJS.import(dependencyLocation).then((importedObject) => {
            imports[key] = importedObject[key] || importedObject.default || importedObject;
        }));
    }

    return Promise.all(promises).then(() => {
        return imports;
    });
}