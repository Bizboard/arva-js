/**
 * Created by lundfall on 06/10/16.
 */


/* Imports that can be needed. TODO: Remove unused dependencies */
import EventEmitter            from 'eventemitter3'
import isEqual                 from 'lodash/isEqual.js'

/* Famous-flex */
import LinkedListViewSequence  from 'famous-flex/LinkedListViewSequence.js'
import LayoutNodeManager       from 'famous-flex/LayoutNodeManager.js'
import FlowLayoutNode          from 'famous-flex/FlowLayoutNode.js'
import LayoutUtility           from 'famous-flex/LayoutUtility.js'

/* Famous */
import Particle                from 'famous/physics/bodies/Particle'
import Transitionable          from 'famous/transitions/Transitionable.js'
import NativeScrollGroup       from 'famous/core/NativeScrollGroup'
import {Surface}               from '../surfaces/Surface.js'
import DOMBuffer               from 'famous/core/DOMBuffer.js'
import PhysicsEngine           from 'famous/physics/PhysicsEngine'
import Engine                  from 'famous/core/Engine.js'
import Timer                   from 'famous/utilities/Timer.js'
import Spring                  from 'famous/physics/forces/Spring'
import Drag                    from 'famous/physics/forces/Drag'
import ScrollSync              from 'famous/inputs/ScrollSync'
import TouchSync               from 'famous/inputs/TouchSync.js'
import EventHandler            from 'famous/core/EventHandler'
import Transform               from 'famous/core/Transform'
import Entity                  from 'famous/core/Entity'
import Vector                  from 'famous/math/Vector'
import Group                   from 'famous/core/Group'
import FamousUtility           from 'famous/utilities/Utility'
import FamousView              from 'famous/core/View.js'

/* Arva */
import { Utils }                 from '../utils/view/Utils.js'
import { combineOptions }        from '../utils/CombineOptions.js'
import { ObjectHelper }          from '../utils/ObjectHelper.js'
import { StackLayout }           from '../layout/functions/StackLayout.js'
import { PushDownSurface }       from './PushDownSurface.js'

//TODO: There's a bug when having chat scrolling on, and adding a lot of stuff, removing it all, and adding them again back

/**
 * Only supports linkedListViews as dataSource. Meant to be used with the dbsv.
 */
export class ScrollController extends FamousView {

  _scrollVoidHeight = 0;
  _scrollTopHeight = 0;
  _previousValues = {
    contextSize: [0, 0],
    scrollOffset: 0
  };
  _cachedSpecs = {};
  _stickingToEnds = {bottom: false, top: false};
  /* Actions for doing before the layout function */
  _commitActions = [];
  _isDirty = true;
  _scrollToTransitionable = new Transitionable();
  /* TODO: Implement functionality for ensurevisible */
  _ensureVisibleNode = null

  constructor (options = {}) {
    super()

    ObjectHelper.bindAllMethods(this, this)
    this.options = combineOptions({
      /* Previously called this._configuredDirection in famous-flex/ScrollController.js */
      layoutDirection: FamousUtility.Direction.Y,
      /*The extra bounds space make up for a smooth insertion and deletion of the nodes at the edges */
      extraBoundsSpace: [0, 0],
      autoPipeEvents: true,
      layoutAll: false,
      showScrollBar: true,
      alwaysLayout: false,
      /* Own layout function that isn't compatible with famous-flex. TODO: Make a collectionlayout equivalent */
      layout: StackLayout,
      layoutOptions: {
        /* Margins are specified with css*/
        margins: LayoutUtility.normalizeMargins(options.layoutOptions ? (options.layoutOptions.margins || [10]) : [10])
      },
      /* Currently only flow: true is supported. TODO: Make flow: false work */
      flow: true,
      /* Set animation option of the flow */
      flowOptions: {},
      /* Set to have some extra estimated scrolling opportunity */
      initialHeight: 0
    }, options)
    this._id = Entity.register(this);

    /* The distance before the first node, e.g. the translate before this._viewSequence.get() */
    this._initOverScrollPhysics();

    this._maxKnownTranslate = this.options.initialHeight;
    this._otherNodes = {bottomScroller: new Surface(), topScroller: new PushDownSurface()};


    /* The thing that provides us the context for the layout function */
    this._layoutNodeManager = new LayoutNodeManager(FlowLayoutNode, (node, spec) => {
      if (!spec && this.options.flowOptions.insertSpec) {
        node.setSpec(this.options.flowOptions.insertSpec)
      }
    }, true)
    this._layoutNodeManager.setNodeOptions(this.options.flowOptions)
    this._initNativeScrollGroup()

    /* TODO: Remove duplicates this._viewSequence, this._dataSource. Kept for DBSV compatibility */
    this._dataSource = this._viewSequence = new LinkedListViewSequence([])

    this.on('recursiveReflow', (forWhichRenderables) => {
      let renderableIDs = Object.keys(forWhichRenderables)
      /* Backwards loop because in almost all the time the last renderable in the sequence is the one to look for*/
      for (let index = renderableIDs.length - 1; index >= 0; index--) {
        let renderableID = renderableIDs[index]
        if (renderableID in this._cachedSpecs) {
          delete this._cachedSpecs[renderableID]
          break
        }
      }
      //TODO change to w/e function does this
      this.reflow();
    })
  }

  insert (position, renderable, insertSpec) {
    insertSpec = insertSpec || this.options.flowOptions.insertSpec

    if (this._currentScrollOffset === 0 && !this.options.chatScrolling) {
      this._enqueueCommitAction(() => this.stickToTopOrBottom(false))
    } else if(this._currentScrollOffset >= this._group.getMaxScrollOffset()){
      this.stickToBottom()
    }

    /* Insert data */
    this._viewSequence.insert(position, renderable)

    this._pipeRenderableAsNecessary(renderable)

    /* Mark as flowy renderable for the layoutnodemanager */
    renderable.isFlowy = true

    if (this._isPositionOutsideCurrentView(position)) {
      return this
    }
    this._accountForModificationsHappeningAtStart()

    /* When a custom insert-spec was specified, store that in the layout-node */
    if (insertSpec) {
      let newNode = this._layoutNodeManager.createNode(renderable, insertSpec)
      newNode.executeInsertSpec()
      newNode.releaseLock(true)
      this._layoutNodeManager.insertNode(newNode)
    }

    this.reflow()
    return this
  };

  remove (position) {


    // Remove the renderable
    let sequence = this._viewSequence.findByIndex(position)

    if (!sequence) {
      Utils.warn(`Cannot remove non-existent index: ${position}`)
      return
    }

    delete this._cachedSpecs[Utils.getRenderableID(sequence._value)]

    this._viewSequence = this._viewSequence.remove(sequence)
    let renderNode = sequence.get()
    /* TODO: Implement logic for remove spec.
     */

    if (this._isPositionOutsideCurrentView(position)) {
      return this
    }
    this._accountForModificationsHappeningAtStart()

    if (renderNode || !this._viewSequence.getLength()) {
      this.reflow()
    }
    return renderNode

  }

  replace (indexOrId, renderable, noAnimation) {
    let sequence = this._viewSequence.findByIndex(indexOrId)
    let oldRenderable = sequence.get()
    if (!oldRenderable) {
      Utils.warn(`Cannot replace non-existent index: ${indexOrId}`)
      return
    }
    if (oldRenderable !== renderable && noAnimation && oldRenderable && (this._ensureVisibleNode === oldRenderable)) {
      this._ensureVisibleNode = renderable
    }
    sequence.set(renderable)
    if (oldRenderable !== renderable) {
      this._pipeRenderableAsNecessary(renderable)
      /* Mark as flowy renderable for the layoutnodemanager */
      renderable.isFlowy = true
      if (noAnimation && oldRenderable) {
        let node = this._layoutNodeManager.getNodeByRenderNode(oldRenderable)
        if (node) {
          node.setRenderNode(renderable)
        }
      } else {
        if (!this._isPositionOutsideCurrentView(indexOrId)) {
          this.reflow()
        }
      }
    }
    this._accountForModificationsHappeningAtStart()
    /* Else, the renderable is the same as the old one, do nothing */

  }

  stickToBottom () {
    this.stickToTopOrBottom(true)
  }

  stickToTopOrBottom (isBottom) {
    let sequenceToMatch = isBottom ? this._viewSequence.getTail() : this._viewSequence.getHead()
    if (sequenceToMatch && this._viewSequence !== sequenceToMatch) {
      this._moveSequence(sequenceToMatch, isBottom)
    }
    this.animateToTopOrBottom(isBottom)

    this._stickingToEnds[isBottom ? 'bottom' : 'top'] = true
    this._stickingToEnds[isBottom ? 'top' : 'bottom'] = false
  }

  /**
   *
   * @param {Boolean} isBottom
   */
  animateToTopOrBottom (isBottom) {
    if (!this._scrollToTransitionable.isActive()) {
      /* Set the scroll transitionable to go from the current position to where it has to go (hence settings twice)*/
      this._scrollToTransitionable.set(Math.max(0, this._group.getScrollOffset()))
      this._scrollToTransitionable.set(Math.max(0, isBottom ? this._group.getMaxScrollOffset() : 0), {
        curve: function linear (x) {
          return x
        }, duration: 300
      }, () => {
        this._group.forceScrollOffsetInvalidation()
      })
    }

  }

  scrollToBottom () {
    this._shouldIgnoreScrollEvent = true
    this._group.scrollToBottom()
  }

  _isPositionOutsideCurrentView (position) {
    return position < this._firstNodeIndex || position > this._lastNodeIndex
  }

  _accountForModificationsHappeningAtStart () {
    /* If we're doing modifications and we're at the beginning, we should be sure to reset the sequence to the first node
     * in order to to update the layout in a faulty way
     */
    if (this._firstNodeIndex === 0) {
      // this._resetSequenceToFirstNode();
    }
  }

  getDataSource () {
    return this._viewSequence
  }

  invalidateLayout () {
    this._reLayout = true
  }

  reflow () {
    this._isDirty = true
    this._cachedSpecs = {}
  }

  _initNativeScrollGroup () {
    this._group = new NativeScrollGroup()
    this._group.add({render: this._innerRender})
    /* Prevent scrolling in the opposite direction */
    this._group.setProperties({[`overflow${this.options.layoutDirection === 0 ? 'Y' : 'X'}`]: 'hidden'})
    this.on('mousewheel', this._onManualScrollAttempt)
    this.on('wheel', this._onManualScrollAttempt)
    this.on('touchmove', this._onManualScrollAttempt)
    this.on('scroll', (e) => {
      this._eventOutput.emit('userScroll', e)
      if (!this._shouldIgnoreScrollEvent) {
        this._shouldIgnoreScrollEvent = false
      }
    })

    if (!this.options.showScrollBar) {
      this._group.addClass('hide-scrollbar')
    }
  }

  _onManualScrollAttempt () {
    this._eventOutput.emit('manualScroll')
    this._didManualScroll = true
    for (let direction in this._stickingToEnds) {
      this._stickingToEnds[direction] = false
    }
  }

  _initOverScrollPhysics () {
    /* These are used for overscrolling */
    this._physicsEngine = new PhysicsEngine(this.options.scrollPhysicsEngine)
    this._overScrollSpring = new Spring({
      dampingRatio: 1,
      period: 400,
      anchor: new Vector([0, 0, 0])
    })
    this._scrollParticle = new Particle({mass: 100})
    this._physicsEngine.addBody(this._scrollParticle)
    this._physicsEngine.attach(this._overScrollSpring, this._scrollParticle)
  }

  _isLayoutNecessary (newSize, newScrollOffset) {

    let upperMargin = this.options.layoutOptions.margins[0]
    let lowerMargin = this.options.layoutOptions.margins[2]
    let lastNormalizedScrollOffset = this._previousValues.normalizedScrollOffset
    let scrollHeight = this._group.getMaxScrollOffset()
    return this._isReflowNecessary() || /* Changes have been made that means that a new flow animation will take place */
      /* Changes have been made that aren't as big as starting new flow animation but still need new layout */
      this._reLayout ||
      /* Size has changed */ !isEqual(newSize, this._previousValues.contextSize) ||
      /* There is no normalizedScollOffset */
      lastNormalizedScrollOffset === undefined ||
      /* The scrolling has changed too much since last normalization */
      Math.abs(lastNormalizedScrollOffset - newScrollOffset) > newSize[this.options.layoutDirection] * 0.8 ||
      (newScrollOffset < upperMargin && lastNormalizedScrollOffset >= upperMargin) ||
      (scrollHeight - newScrollOffset < lowerMargin && scrollHeight - lastNormalizedScrollOffset >= lowerMargin) ||
      /* We should always layout */
      this.options.alwaysLayout

  }

  _isReflowNecessary () {
    return this._isDirty
  }

  _pipeRenderableAsNecessary (renderable) {
    if (this.options.autoPipeEvents && renderable && renderable.pipe) {
      renderable.pipe(this)
      renderable.pipe(this._eventOutput)
    }
  }

  _enqueueCommitAction (actionToPerform) {
    this._commitActions.push(actionToPerform)
  }

  _layout (size, scrollOffset) {

    let scrollSize = size[this.options.layoutDirection]
    let scrollLength = this._maxKnownTranslate + this.options.extraBoundsSpace[1]
    /* Display elements that are one screen above and one screen below */
    let scrollStart = scrollOffset - scrollSize - this._scrollTopHeight
    let scrollEnd = scrollSize * 2 + scrollOffset - this._scrollTopHeight

    /* If everything should be layouted, then are bounds should be infinite */
    if (this.options.layoutAll) {
      scrollStart = -this._scrollTopHeight
      scrollEnd = 10000
    }

    /* Prepare for layout */
    let layoutContext = this._layoutNodeManager.prepareForLayout(
      this._viewSequence, /* first node to layout */
      this._otherNodes, /* Nodes by id */
      {
        size,
        direction: this.options.layoutDirection,
        reverse: false,
        scrollOffset: this._scrollVoidHeight + this.options.extraBoundsSpace[0],
        scrollStart,
        scrollEnd,
        scrollLength,
        scrollTopHeight: this._scrollTopHeight
      },
    )

    /* Call speificied layout function */
    this.options.layout(
      layoutContext, /* context which the layout-function can use */
      this.options.layoutOptions      /* additional layout-options */
    )

    /* Currently no support for postLayout function. TODO: Examine whether we need a postlayout function */

    /* Mark non-invalidated nodes for removal */
    this._layoutNodeManager.removeNonInvalidatedNodes(this.options.flowOptions.removeSpec)

    this._normalizeSequence(scrollOffset, scrollSize)
    this._adjustTotalHeight(scrollOffset, scrollSize)

    /* Cleanup nodes */
    this._layoutNodeManager.removeVirtualViewSequenceNodes()

    this._updateThisSizeCache()
  }

  _updateThisSizeCache () {
    let scrollLength = 0
    let node = this._layoutNodeManager.getStartEnumNode()
    while (node) {
      if (node._invalidated && node.scrollLength) {
        scrollLength += node.scrollLength
      }
      node = node._next
    }

    this._size = [undefined, undefined]
    this._size[this.options.layoutDirection] = scrollLength
  }

  _adjustTotalHeight (scrollOffset, scrollSize) {
    this._adjustDistanceToTop(scrollOffset, scrollSize)
    this._adjustDistanceToBottom(scrollOffset, scrollSize)
  }

  _adjustDistanceToTop (scrollOffset, scrollSize) {
    let firstNode = this._layoutNodeManager.getFirstRenderedNode()
    /* Determine the position of the first node */
    if (firstNode && !this._stickingToEnds.bottom) {
      /* If this if clause is true, we need to allocate more space to scroll upwards */
      if (this._firstNodeIndex !== 0 && scrollOffset <= this.options.layoutOptions.margins[0] && this._group.getMaxScrollOffset()) {
        /* If we can't scroll that much, we also can't allocate too much space at the top since
         * allocating space at top also implies scrolling down with the same amount.
         */
        let extraSpaceToAllocate = Math.min(scrollSize, this._group.getMaxScrollOffset())
        this._allocateExtraHeightAtTop(extraSpaceToAllocate, scrollOffset)
        /* If we are the first node, then redefine the top position. It can have been (over/under)estimated previously */
        //TODO This if clause triggers too often
      } else if (this._firstNodeIndex === 0 && (firstNode.getTranslate()[this.options.layoutDirection] + this._scrollTopHeight) !== this.options.layoutOptions.margins[0]
      ) {
        let newScrollTopHeight = this.options.layoutOptions.margins[0] - firstNode.getTranslate()[this.options.layoutDirection]
        if (newScrollTopHeight > this._scrollTopHeight) {
          let scrollTopHeightDiff = newScrollTopHeight - this._scrollTopHeight
          this._allocateExtraHeightAtTop(scrollTopHeightDiff, scrollOffset)
        } else {
          this._setScrollTopHeight(newScrollTopHeight)
        }
      }
    }
  }

  _adjustDistanceToBottom (scrollOffset, scrollSize) {
    /* Determine what the point furthest away was */
    let lastNode = this._layoutNodeManager.getLastRenderedNode()
    if (lastNode) {
      let bottomPosition = lastNode.getTranslate()[this.options.layoutDirection] + lastNode.scrollLength
      /* If we are seeing the last node, then redefine the bottom position. It can have been (over/under)estimated previously */
      if (lastNode.renderNode === this._layoutNodeManager.getLastRenderNodeInSequence()) {
        if (bottomPosition !== this._maxKnownTranslate) {
          this._enqueueCommitAction(this.invalidateLayout)
          this._maxKnownTranslate = bottomPosition
        }
      } else {
        this._maxKnownTranslate = Math.max(this._maxKnownTranslate, bottomPosition)
      }
    } else {
      /* If there are no nodes, then the max translate should not be anywhere else than at the top */
      this._maxKnownTranslate = 0
    }
  }

  _allocateExtraHeightAtTop (space, scrollOffset) {
    if (!this._allocationLock) {
      this._allocationLock = true
      this._setScrollTopHeight(this._scrollTopHeight + space)
      this._otherNodes.topScroller.once('resize', () => {
        this._group.setScrollOffset(space + this._currentScrollOffset)
        this._allocationLock = false
      })
    }

  }

  _setScrollTopHeight (scrollTopHeight) {
    /* TODO: If anything doesn't work well when scrolling upwards through the roof, try adding this line:
     /* this._cachedSpecs = {} */

    this._scrollTopHeight = scrollTopHeight
    /* Negative height exists in CSS if done as negative margin-top */
    this._otherNodes.topScroller.setProperties({'margin-top': `${scrollTopHeight < 0 ? scrollTopHeight : 0}px`})
    this._enqueueCommitAction(this.invalidateLayout.bind(this))
  }

  /**
   * Determines whether the user has scrolled to the bottom
   * @returns {boolean} True if the scroll is all the way to the bottom
   */
  isAtBottom () {
    return Math.floor(this._group.getScrollOffset()) >= Math.floor(this._group.getMaxScrollOffset())
  }

  isAtTop () {
    return this._group.getScrollOffset() === 0
  }

  /**
   * Normalizes the viewsequence so that the layout function doens't have to loop through more nodes than necessary
   * @param {Integer} scrollOffset
   * @param {Integer} scrollSize
   * @returns {boolean}
   * @private
   */
  _normalizeSequence (scrollOffset, scrollSize) {
    this._previousValues.normalizedScrollOffset = scrollOffset
    this._firstNodeIndex = this._layoutNodeManager.getFirstRenderedNodeIndex()
    this._lastNodeIndex = this._layoutNodeManager.getLastRenderedNodeIndex()

    let sequenceHead = this._viewSequence.getHead()
    let sequenceTail = this._viewSequence.getTail()
    /* Normalize to top to make sure that the top margin is correct */

    let shouldAllowScroll = this._layoutNodeManager.getCoveredScrollHeight() >= scrollSize || !this.options.chatScrolling
    this._group.setProperties({[`overflow${this.options.layoutDirection === 1 ? 'Y' : 'X'}`]: shouldAllowScroll ? 'scroll' : 'hidden'})

    if (sequenceHead && scrollOffset <= this.options.layoutOptions.margins[0] && this._stickingToEnds.bottom) {
      /* Make sure that we're seeing the first node and just not temporary hitting bottom*/
      this._scrollVoidHeight = scrollSize
    }
    /* Normalize to bottom to make sure that the bottom margin is always correct. TODO This if-clause triggers too often. Further more, forceNormalizeBottom seems unused */
    else if (this._forceNormalizeBottom ||
      (sequenceTail && this._group.getMaxScrollOffset() - scrollOffset <= this.options.layoutOptions.margins[1] &&
        /* Make sure that we're seeing the last node and just not temporary hitting bottom*/
        (this._lastNodeIndex === Infinity || this._lastNodeIndex === sequenceTail.getIndex())
      ) &&
      !this._stickingToEnds.top) {
      if (this._forceNormalizeBottom) {
        this._forceNormalizeBottom = false
      }
      if (sequenceTail !== this._viewSequence) {
        this._moveSequence(sequenceTail, true)
        this._enqueueCommitAction(this.invalidateLayout)
        return
      }
    }

    /* Normalize if we are somewhere in the middle */
    if (this._layoutNodeManager.isSequenceMoved() && !this._stickingToEnds.bottom) {
      let isForwards = this._layoutNodeManager.getMovedSequenceDirection() === 1
      /* Normalize scroll offset so that the current viewsequence node is as close to the
       * top as possible and the layout function will need to process the least amount
       * of renderables.*/
      let normalizedStartSequence = this._layoutNodeManager.getStartSequence()
      if (normalizedStartSequence) {
        this._moveSequence(normalizedStartSequence, isForwards)
        this._enqueueCommitAction(this.invalidateLayout)
      }
    }

  }

  /**
   * Resets the sequence to the first node, as it started out
   * @private
   */
  _resetSequenceToFirstNode () {
    this._moveSequence(this._viewSequence.getHead(), false)
  }

  /**
   * Moves the sequence to the specific node
   * @param newSequence
   * @param isForwards
   * @private
   */
  _moveSequence (newSequence, isForwards) {
    let node = this._layoutNodeManager.getStartEnumNode(isForwards)
    let oldScrollVoidHeight = this._scrollVoidHeight
    while (node && node.renderNode !== newSequence.get()) {
      /* If there is no scrollLength, then it must be the bottomScroller, skip it */
      if (node.scrollLength) {
        if (isForwards) {
          this._scrollVoidHeight += node.scrollLength || 0
        } else {
          this._scrollVoidHeight -= node.scrollLength || 0
        }
      }
      node = isForwards ? node._next : node._prev
    }
    if (!isForwards) {
      if (node) {
        this._scrollVoidHeight -= node.scrollLength || 0
      }
    }
    this._viewSequence = newSequence
    return oldScrollVoidHeight - this._scrollVoidHeight
  }

  /* Used to return the specs by the native group */
  _innerRender () {
    let specsForThisCommit = {}
    for (let [index, spec] of this._specs.entries()) {
      if (spec.renderNode === this._otherNodes.bottomScroller ||
        ( spec.renderNode &&
        (!this._nodes[index].stoppedFlowing || this._nodes[index].stoppedFlowing()
        ))
      ) {
        this._cachedSpecs[spec.target] = spec
      } else {
        specsForThisCommit[spec.target] = spec
      }
    }
    Object.assign(specsForThisCommit, this._cachedSpecs)
    let specs = Object.keys(specsForThisCommit).map((target) => specsForThisCommit[target])
    /* Removed cleanup registration code.
     TODO: Examine whether the cleanup registration is still necessary to add here */
    return specs
  }

  /**
   *  Gets the size of the scrollcontroller
   *  */
  getSize () {
    return this._size || [undefined, undefined]
  }

  /**
   * Performs enqueued functions
   */

  _performEnqueuedCommitActions () {
    let actionsToPerform = [...this._commitActions]
    this._commitActions = []
    for (let action of actionsToPerform) {
      action()
    }
  }

  commit (context) {
    let {size, transform} = context

    this._performEnqueuedCommitActions()

    let scrollOffset
    if (this._scrollToTransitionable.isActive()) {
      scrollOffset = this._scrollToTransitionable.get()
      this._group.setScrollOffset(scrollOffset)
    } else {
      scrollOffset = this._group.getScrollOffset()
    }
    this._currentScrollOffset = scrollOffset

    let eventData = {
      target: this,
      oldSize: this._previousValues.contextSize,
      size,
      oldScrollOffset: this._previousValues.scrollOffset,
      scrollOffset
    }
    let didLayout = false

    //TODO: Add events scrollstart and scrollend, or maybe not. Not sure if needed
    if (this._isLayoutNecessary(size, scrollOffset)) {

      didLayout = true
      this._eventOutput.emit('layoutstart', eventData)

      /* When the layout has changed, and we are not just scrolling,
       * disable the locked state of the layout-nodes so that they
       * can freely transition between the old and new state. */
      if (this.options.flow && (this._isReflowNecessary())) {
        /* TODO Refactor linkedViewList to support symbol.iterator so we can do for of */
        let node = this._layoutNodeManager.getStartEnumNode()
        while (node) {
          if (node.releaseLock) {
            node.releaseLock(true)
          }
          node = node._next
        }
      }

      /* Perform layout */
      this._layout(size, scrollOffset)
    } else {
      /* Reset the ensureVisibleRenderNode to prevent unwanted behaviour when doing replace and not finding the renderable */
      this._ensureVisibleNode = null
    }
    /* Do the paper-work for creating the entire spec for the nodes */
    //TODO See if we have to add a translate here
    let result
    if (this._previousValues.resultModified || didLayout) {
      result = this._layoutNodeManager.buildSpecAndDestroyUnrenderedNodes()
      this._nodes = result.nodes
      this._specs = result.specs
    }

    if (result && result.modified) {
      this._eventOutput.emit('reflow', {
        target: this
      })
    }

    /* Reset variables */
    this._isDirty = false
    this._reLayout = false

    this._previousValues.scrollDelta = this._previousValues.scrollOffset ? this._previousValues.scrollOffset - scrollOffset : 0
    this._previousValues.scrollOffset = scrollOffset
    this._previousValues.contextSize = size
    this._previousValues.resultModified = (result && result.modified) || didLayout
    this._previousValues.maxKnownTranslate = this._maxKnownTranslate

    if (this._stickingToEnds.bottom && !this.isAtBottom()) {
      this.animateToTopOrBottom(true)
    }

    if (this._stickingToEnds.top && !this.isAtTop()) {
      this.animateToTopOrBottom(false)
    }

    this._didManualScroll = false

    //TODO Remove this code if we really don't want overscroll animation
    /*/!* Check if we can scroll anywhere at all, and if the physics engine is sleeping. In that case make an overscroll
     * animation *!/
     if (this._physicsEngine.isSleeping() && this._group.getMaxScrollOffset()) {
     if ((scrollOffset === 0 && this._firstNodeIndex === 0) || (this.isAtBottom() && this._lastNodeIndex === Infinity)) {
     this._startOverscrollAnimation()
     }
     } else if (!this.isAtBottom() && scrollOffset !== 0) {
     this._physicsEngine.sleep()
     }*/
    let extraTranslate = [0, 0, 0]
    /* Adjust transform and size to extra bounds */
    extraTranslate[this.options.layoutDirection] = -this.options.extraBoundsSpace[0]
    let expandedSize = [...size]
    expandedSize[this.options.layoutDirection] += this.options.extraBoundsSpace[0] + this.options.extraBoundsSpace[1]

    if (!this._physicsEngine.isSleeping()) {
      extraTranslate[this.options.layoutDirection] += this._scrollParticle.getPosition1D()
    }

    transform = Transform.thenMove(transform, extraTranslate)

    if (didLayout) {
      this._eventOutput.emit('layoutend', eventData)
      /* Removed the logic for emitting pagechange, for now. TODO: Possibly, add it back */
    }

    // Return the spec
    return {
      transform,
      size: expandedSize,
      opacity: context.opacity,
      origin: context.origin,
      target: this._group.render()
    }
  }

  //todo remove
  _startOverscrollAnimation () {
    let scrollVelocity = this._previousValues.scrollDelta / Engine.getFrameTimeDelta()
    this._scrollParticle.setVelocity1D(Math.min(scrollVelocity, 10))
    this._physicsEngine.wake()
  }

  render () {
    return this._id
  }

  getID () {
    return this._id
  }
}