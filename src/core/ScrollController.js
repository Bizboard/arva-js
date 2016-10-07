/**
 * Created by lundfall on 06/10/16.
 */


/* Imports that can be needed. TODO: Remove unused dependencies */
import EventEmitter            from 'eventemitter3'
import isEqual                 from 'lodash/isEqual.js';

/* Famous-flex */
import LinkedListViewSequence  from 'famous-flex/LinkedListViewSequence.js';
import ListLayout              from 'famous-flex/layouts/ListLayout.js';
import LayoutController        from 'famous-flex/LayoutController.js';
import LayoutNodeManager       from 'famous-flex/LayoutNodeManager.js';
import FlowLayoutNode          from 'famous-flex/FlowLayoutNode.js';
import LayoutUtility           from 'famous-flex/LayoutUtility.js';
import LayoutNode              from 'famous-flex/LayoutNode.js';

/* Famous */
import Particle                from 'famous/physics/bodies/Particle';
import NativeScrollGroup       from 'famous/core/NativeScrollGroup';
import Surface                  from 'famous/core/Surface.js';
import PhysicsEngine           from 'famous/physics/PhysicsEngine';
import Engine                  from 'famous/core/Engine.js';
import Spring                  from 'famous/physics/forces/Spring';
import Drag                    from 'famous/physics/forces/Drag';
import ScrollSync              from 'famous/inputs/ScrollSync';
import EventHandler            from 'famous/core/EventHandler';
import Transform               from 'famous/core/Transform';
import Entity                  from 'famous/core/Entity';
import Vector                  from 'famous/math/Vector';
import Group                   from 'famous/core/Group';
import FamousUtility           from 'famous/utilities/Utility';
import FamousView              from 'famous/core/View.js';


/* Arva */
import {Utils}                 from '../utils/view/Utils.js';
import {combineOptions}        from '../utils/CombineOptions.js';
import {ObjectHelper}          from '../utils/ObjectHelper.js';
import {StackLayout}           from '../layout/functions/StackLayout.js';


/**
 * Only supports linkedListViews as dataSource. Meant to be used with the dbsv.
 * TODO: Look at insert specs, layout normalize logic and registered remove function
 */
export class ScrollController extends FamousView {
    constructor(options = {}) {
        super();

        ObjectHelper.bindAllMethods(this, this);
        this.options = combineOptions({
            /* Previously called this._configuredDirection in famous-flex/ScrollController.js */
            layoutDirection: FamousUtility.Direction.Y,
            extraBoundsSpace: [100, 100],
            dataSource: [],
            autoPipeEvents: true,
            layoutAll: false,
            alwaysLayout: true,             //TODO: Change to false, for debugging for now
            layout: StackLayout,
            layoutOptions: {margins: LayoutUtility.normalizeMargins(options.layoutOptions ? (options.layoutOptions.margins || [100]) : [100])},
            flow: true,
            flowOptions: {},
            initialHeight: 0                // Set to have some extra estimated scrolling opportunity
        }, options);
        this._id = Entity.register(this);
        this._isDirty = true;
        this._dirtyRenderables = [];
        /* The distance before the first visible node */
        this._scrollVoidHeight = 0;
        this._previousValues = {
            contextSize: [0, 0],
            scrollOffset: 0
        };
        this._maxKnownTranslate = this.options.initialHeight;
        let bottomScroller = new Surface();
        bottomScroller.setSize([1, 1]);
        this._otherNodes = {bottomScroller: new Surface(1,1)}

        this._ensureVisibleNode = null;

        this._layoutNodeManager = new LayoutNodeManager(FlowLayoutNode, (node, spec) => {
            if (!spec && this.options.flowOptions.insertSpec) {
                node.setSpec(this.options.flowOptions.insertSpec);
            }
        });
        Engine.enableTouchMove();
        // Create groupt for faster rendering
        this._group = new NativeScrollGroup();
        this._group.add({render: this._innerRender});
        this._group.setProperties({[`overflow${this.options.layoutDirection === 0 ? 'Y' : 'X'}`]:'hidden'});
        /* TODO: Remove duplicates this._viewSequence, this._dataSource. Kept for DBSV compatibility */
        this._dataSource = this._viewSequence = new LinkedListViewSequence(this.options.dataSource);
    }

    setOptions() {
        //TODO: Implement
    }

    insert(position, renderable, insertSpec) {
        insertSpec = insertSpec || this.options.flowOptions.insertSpec;

        /* Insert data */
        this._viewSequence.insert(position, renderable);

        /* When a custom insert-spec was specified, store that in the layout-node */
        if (insertSpec) {
            let newNode = this._layoutNodeManager.createNode(renderable, insertSpec);
            newNode.executeInsertSpec();
            this._layoutNodeManager.insertNode(newNode);
        }

        this._pipeRenderableAsNecessary();

        this.reflow();
        this._dirtyRenderables.push(renderable);
        return this;
    };

    remove(position) {
        // Remove the renderable
        let sequence = this._viewSequence.findByIndex(position);
        if (!sequence) {
            Utils.warn(`Cannot remove non-existent index: ${position}`);
            return;
        }

        this._viewSequence = this._viewSequence.remove(sequence);
        let renderNode = sequence.get();
        /* TODO: Implement logic for remove spec.
         * e.g. bla bla...
         */
        if (renderNode) {
            this.reflow();
            return renderNode;
        }
    }

    replace(indexOrId, renderable, noAnimation) {
        let sequence = this._viewSequence.findByIndex(indexOrId);
        let oldRenderable = sequence.get();
        if (!oldRenderable) {
            Utils.warn(`Cannot replace non-existent index: ${position}`);
            return;
        }
        if (oldRenderable !== renderable && noAnimation && oldRenderable && (this._ensureVisibleNode === oldRenderable)) {
            this._ensureVisibleNode = renderable;
        }
        sequence.set(renderable);
        if (oldRenderable !== renderable) {
            this._pipeRenderableAsNecessary(renderable);
            if (noAnimation && oldRenderable) {
                let node = this._layoutNodeManager.getNodeByRenderNode(oldRenderable);
                if (node) {
                    node.setRenderNode(renderable);
                }
            } else {
                this.reflow();
            }
        }

    }

    getDataSource() {
        return this._viewSequence;
    }

    invalidateLayout() {
        this._reLayout = true;
    }

    _isLayoutNecessary(newSize, newScrollOffset) {
        // When the size or layout function has changed, reflow the layout
        /* TODO Add check for if physics engine is doing stuff (prolly) */
        return this._isReflowNecessary() || !isEqual(newSize, this._previousValues.size) ||
            newScrollOffset !== this._previousValues.scrollOffset ||
            this._reLayout ||
            this.options.alwaysLayout
    }

    reflow() {
        this._isDirty = true;
    }

    _isReflowNecessary() {
        return this._isDirty;
    }

    _pipeRenderableAsNecessary(renderable) {
        if (this.options.autoPipeEvents && renderable && renderable.pipe) {
            renderable.pipe(this);
            renderable.pipe(this._eventOutput);
        }
    }

    _layout(size, scrollOffset) {

        // Determine start & end
        let scrollStart = 0 - Math.max(this.options.extraBoundsSpace[0], 1) + scrollOffset;
        let scrollEnd = size[this.options.layoutDirection] + Math.max(this.options.extraBoundsSpace[1], 1) + scrollOffset;

        if (this.options.layoutAll) {
            scrollStart = -1000000;
            scrollEnd = 1000000;
        }

        // Prepare for layout
        let layoutContext = this._layoutNodeManager.prepareForLayout(
            this._viewSequence, /* first node to layout */
            this._otherNodes,   /* Nodes by id */
            {
                size,
                direction: this.options.layoutDirection,
                reverse: false,
                scrollOffset: this._scrollVoidHeight,
                scrollStart,
                scrollEnd,
                scrollLength: this._maxKnownTranslate
            },
        );

        /* Call speificied layout function */
        this.options.layout(
            layoutContext, /* context which the layout-function can use */
            this.options.layoutOptions      /* additional layout-options */
        );

        /* Currently no support for postLayout function. TODO: Examine whether we need a postlayout function */

        /* Mark non-invalidated nodes for removal */
        this._layoutNodeManager.removeNonInvalidatedNodes(this.options.flowOptions.removeSpec);


        let lastNode = this._layoutNodeManager.getLastNode();
        if(lastNode){
            this._maxKnownTranslate = Math.max(this._maxKnownTranslate, lastNode.getTranslate()[this.options.layoutDirection]);
        }

        /* Normalize scroll offset so that the current viewsequence node is as close to the
         * top as possible and the layout function will need to process the least amount
         of renderables.  */
        let normalizedStartSequence = this._layoutNodeManager.getStartSequence();
        if (normalizedStartSequence) {
            let node = this._layoutNodeManager.getStartEnumNode(true);
            while (node.renderNode !== normalizedStartSequence.get() && node) {
                this.options.extraBoundsSpace[0] += node.scrollLength;
                this._scrollVoidHeight += node.scrollLength;
                node = node._next;
            }
            console.log("New base");
            this._viewSequence = normalizedStartSequence;
        }


        // If the bounds have changed, and the scroll-offset would be different
        // than before, then re-layout entirely using the new offset.
        /*var newScrollOffset = _calcScrollOffset.call(this, true);
         if (!nested && (newScrollOffset !== scrollOffset)) {
         //_log.call(this, 'offset changed, re-layouting... (', scrollOffset, ' != ', newScrollOffset, ')');
         return _layout.call(this, size, newScrollOffset, true);
         }*/
        // Update spring
        /*_updateSpring.call(this);*/

        // Cleanup any nodes in case of a VirtualViewSequence
        this._layoutNodeManager.removeVirtualViewSequenceNodes();

        this._updateThisSizeCache();
        return scrollOffset;
    }

    _updateThisSizeCache() {
        let scrollLength = 0;
        let node = this._layoutNodeManager.getStartEnumNode();
        while (node) {
            if (node._invalidated && node.scrollLength) {
                scrollLength += node.scrollLength;
            }
            node = node._next;
        }

        this._size = [undefined, undefined];
        this._size[this.options.layoutDirection] = scrollLength;
    }

    _innerRender() {
        for (let spec of this._specs) {
            if (spec.renderNode) {
                spec.target = spec.renderNode.render();
            }
        }
        /* Removed cleanup registration code. TODO: Examine whether the cleanup registration is still necessary to add here */
        return this._specs;
    }

    getSize() {
        return this._size || [undefined, undefined];
    }

    commit(context) {
        let {size, transform} = context;
        let scrollOffset = this._group.getScrollOffset();
        let eventData;
        //TODO: Add events scrollstart and scrollend
        if (this._isLayoutNecessary(size, scrollOffset)) {

            // Prepare event data
            eventData = {
                target: this,
                oldSize: this._previousValues.contextSize,
                size,
                oldScrollOffset: this._previousValues.scrollOffset,
                scrollOffset
            };
            this._eventOutput.emit('layoutstart', eventData);

            // Perform layout
            scrollOffset = this._layout(size, scrollOffset);
            this._scrollOffsetCache = scrollOffset;

            /* Depending on whether an inserted node is in view or not, we might have to enable flowing mode */
            if (this._dirtyRenderables.length) {
                this._isDirty = !this._dirtyRenderables.every((dirtyRenderable) => !this._layoutNodeManager.isNodeInCurrentBuild(dirtyRenderable));
                this._dirtyRenderables = [];

            }

            /* When the layout has changed, and we are not just scrolling,
             * disable the locked state of the layout-nodes so that they
             * can freely transition between the old and new state. */
            if (this.options.flow && (this._isReflowNecessary())) {
                /* TODO Refactor linkedViewList to support symbol.iterator so we can do for of */
                let node = this._layoutNodeManager.getStartEnumNode();
                while (node) {
                    node.releaseLock(true);
                    node = node._next;
                }
            }
        } else {
            /* Reset the ensureVisibleRenderNode to prevent unwanted behaviour when doing replace and not finding the renderable */
            this._ensureVisibleNode = null;
        }
        /* Do the paper-work for creating the entire spec for the nodes */
        //TODO See if we have to add a translate here
        var result = this._layoutNodeManager.buildSpecAndDestroyUnrenderedNodes(undefined);
        this._specs = result.specs;

        if (result.modified) {
            this._eventOutput.emit('reflow', {
                target: this
            });
        }


        /* Reset variables */
        this._isDirty = false;
        this._reLayout = false;
        this._previousValues = {
            scrollOffset,
            contextSize: size,
            resultModified: result.modified
        };

        if (eventData) { /* eventData is only used here to check whether there has been a re-layout */
            this._eventOutput.emit('layoutend', eventData);
            /* Removed the logic for emitting pagechange, for now. TODO: Possibly, add it back */
        }
        /*this._group.setScrollOffset(scrollOffset);*/

        // Return the spec
        return {
            transform: transform,
            size: size,
            opacity: context.opacity,
            origin: context.origin,
            target: this._group.render()
        };
    }

    render() {
        return this._id;
    }
}