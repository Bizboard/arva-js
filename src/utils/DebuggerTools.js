/**
 * Created by lundfall on 06/07/2017.
 */
import Surface              from 'famous/core/Surface.js';
import SpecParser           from 'famous/core/SpecParser.js';

import Entity               from 'famous/core/Entity.js'
import RenderNode           from 'famous/core/RenderNode.js'
import { View }             from 'arva-js/core/View.js'
import { ObjectHelper }     from 'arva-js/utils/ObjectHelper.js'
import { Utils }            from 'arva-js/utils/view/Utils.js'
import { layout }           from 'arva-js/layout/Decorators.js'
import { PrioritisedArray}  from 'arva-js/data/PrioritisedArray.js'
import EventEmitter         from 'famous/core/EventEmitter.js'

window.getFromID = (id) => {
    return Entity.get(id)
};

window.views = {};
window.prioArrays = {};


window.muteLogs = true;

window.debugSizes = false;

let originalGetSize = View.prototype.getSize;
View.prototype.getSize = function () {
    if(!window.debugSizes){
        return originalGetSize.call(this, ...arguments);
    }
    console.group(this.constructor.name);
    let returnValue = originalGetSize.call(this, ...arguments);
    console.log(returnValue);
    console.groupEnd(this.constructor.name);
    return returnValue;
};

let originalAssignRenderable = View.prototype._assignRenderable;
View.prototype._assignRenderable = function (renderable, renderableName) {
    renderable.__hiddenRenderableName__ = renderableName;
    return originalAssignRenderable.call(this, ...arguments);
};

let originalCopyPrototypeProperties= View.prototype._copyPrototypeProperties;
View.prototype._copyPrototypeProperties = function () {
    window.views[this._name()] = this;
    return originalCopyPrototypeProperties.call(this, ...arguments)
};

let originalBuildFromSnapshot = PrioritisedArray.prototype._buildFromSnapshot;
PrioritisedArray.prototype._buildFromSnapshot = function () {
    window.prioArrays[this.constructor.name] = this;
    return originalBuildFromSnapshot.call(this, ...arguments)
};

let originalConstructLayoutController = View.prototype._createLayoutController;
View.prototype._createLayoutController = function () {
    originalConstructLayoutController.call(this, ...arguments)
    this.layout._view = this;
    this.layout.__hiddenViewName__ = this._name();
};

let secretRedBackground = Symbol('secretRedBackground');
View.prototype.makeRED = function () {
    this._arrangeRenderableAssignment(this[secretRedBackground], Surface.with({properties: {backgroundColor: 'red'}}),
        [], secretRedBackground, [layout.fullSize()])
    this.reflowRecursively();
};

let originalWarn = Utils.warn;
Utils.warn = function () {
    originalWarn.call(this, ...arguments);
    debugger;
};

let log = (...consoleArgs) => {
    if(window.muteLogs){
        return
    }
    console.log(...consoleArgs);
};



window.ObjectHelper = ObjectHelper;

let originalEmit = EventEmitter.prototype.emit;
EventEmitter.prototype.emit = function (type) {
    let result = originalEmit.call(this, ...arguments)
    if (typeof document.body['on' + type] === 'undefined' && ![
            /* Exclude common events that emit too often */
            'layoutstart',
            'layoutend',
            'sizeChanged',
            'reflow',
            'start',
            'newSize',
            'end',
            'update',
            'layoutControllerReflow',
            'deploy',
            'recursiveReflow',
            'postrender',
            'prerender',
            'change'].includes(type) && Number.isNaN(+type)) {
        log(`Event emitted: ${type}`, this._owner)
    }
    return result
};

//TODO Support a more abd ass version of this using proxies
window.observePropertySet = (object, propertyName) => {
    let value = object[propertyName];
    Object.defineProperty(object, propertyName, {get: () => value, set: (newValue) => {
        value = newValue;
        debugger; }, enumerable: false})
};

let viewDebugSettings = new Map();
window.unDebugLayoutFunction = (view) => {
    let settings = viewDebugSettings.get(view.constructor);
    settings.debug = false;
};
window.debugLayoutFunction = (view) => {
    let settings = {debug: true};
    view._doReflow();
    if(viewDebugSettings.get(view)){
        return;
    }
    viewDebugSettings.set(view, settings);
    let originalLayoutFunction = view._layoutDecoratedRenderables;
    view._layoutDecoratedRenderables = function() {
        if(settings.debug){
            debugger;
        }
        originalLayoutFunction.call(view, ...arguments);
    };
};

let surfaceDebugSettings = new Map();
window.unDebugCommitFunction = (renderable) => {
    let settings = surfaceDebugSettings.get(renderable);
    settings.debug = false;
};

window.debugCommitFunction = (renderable) => {
    let settings = {debug: true};
    if(surfaceDebugSettings.get(renderable)){
        return;
    }
    surfaceDebugSettings.set(renderable, settings);
    let originalCommitFunction = renderable.commit;
    renderable.commit = function() {
        if(settings.debug){
            debugger;
        }
        originalCommitFunction.call(renderable, ...arguments);
    };
};

window.debugFunction = (object, name) => {
    let originalFunction = object[name];
    object[name] = function() {
        debugger;
        originalFunction.call(object, ...arguments);
    };
};

RenderNode._applyCommit = (spec, context, cacheStorage, nestedList = []) => {
    var result = SpecParser.parse(spec, context);
    var keys = Object.keys(result);
    for (var i = 0; i < keys.length; i++) {
        var id = keys[i];
        var childNode = Entity.get(id);
        var commitParams = result[id];
        commitParams.allocator = context.allocator;
        var commitResult = childNode.commit(commitParams);
        if (commitResult) {
            var thingsToAdd = childNode.__hiddenViewName__ ? [childNode.__hiddenViewName__] :  [];
            thingsToAdd = thingsToAdd.concat(childNode._view && childNode._view.__hiddenRenderableName__ || [])
            /* Replace white space since adding white space to a class name causes the DOM to revolt */
                .map((string) => string.replace(' ', ''));
            RenderNode._applyCommit(commitResult, context, cacheStorage, nestedList.concat(thingsToAdd));
        } else {
            cacheStorage[id] = commitParams;
            childNode.setAttributes && childNode.setAttributes({'data-name': childNode.__hiddenRenderableName__ || ''});
            childNode.setClasses && childNode.setClasses(nestedList);
        }
    }
};

