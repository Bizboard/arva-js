/**
 * Created by tom on 23/10/15.
 */

import System                   from 'systemjs';
import sinon                    from 'sinon';
import '../../config.js';
import requestAnimationFrame        from 'request-animation-frame-mock';

export function mockDependency(dependency, replacement) {

    if (!replacement) {
        replacement = sinon.stub();
    }
    if (typeof replacement === 'function') {
        replacement = {default: replacement};
    }

    System.delete(System.normalizeSync(dependency));
    System.set(System.normalizeSync(dependency), System.newModule(replacement));
}

export function restoreDependency(dependency) {
    System.delete(System.normalizeSync(dependency));
}

export function mockDOMGlobals() {
    if (global) {
        global['history'] = [];
        history.pushState = function(){
            let newHash = Array.from(arguments).splice(-1)[0];
            window.location.hash  = newHash;
        };
        global['document'] = {
            documentElement: {style: {}},
            createElement: sinon.stub().returns({
                style: {},
                addEventListener: new Function(),
                classList: {add: sinon.stub()}
            }),
            createDocumentFragment: sinon.stub().returns({
                appendChild: sinon.stub()
            })
        };
        global['window'] = {
            requestAnimationFrame: requestAnimationFrame.mock.requestAnimationFrame,
            addEventListener: new Function(),
            location: {hash: ''}
        };
        global['Node'] = sinon.stub();
    }
    else {
        window['Node'] = sinon.stub();
    }
}


export function restoreDOMGlobals() {
    if (global && (global['window'] || global['document'])) {
        delete global['document'];
        delete global['window'];
    }

}


export function loadDependencies(dependencies) {
    let imports = {};
    let promises = [];

    for (let key in dependencies) {
        let dependencyLocation = dependencies[key];
        promises.push(System.import(dependencyLocation).then((importedObject) => {
            imports[key] = importedObject[key] || importedObject.default || importedObject;
        }));
    }

    return Promise.all(promises).then(() => {
        return Promise.resolve(imports);
    });
}