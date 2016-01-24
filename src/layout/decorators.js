/**
 This Source Code is licensed under the MIT license. If a copy of the
 MIT-license was not distributed with this file, You can obtain one at:
 http://opensource.org/licenses/mit-license.html.

 @author: Hans van den Akker (mysim1)
 @license MIT
 @copyright Bizboard, 2016

 */

import _ from 'lodash';



function _getRenderableDefinition(id) {
  let renderablePosition = _.findIndex(this.lazyRenderableList, function(definition) {
    return definition.id == id;
  });

  if (renderablePosition!=-1) {
    return this.lazyRenderableList[renderablePosition];
  }
  else {
    return null;
  }
}

export const layout = {

  fullscreen: function(target, renderable, properties) {

    if (!target.lazyRenderableList) target.lazyRenderableList = [];
    let renderableDefinition = _getRenderableDefinition.call(target, renderable);

    if (!renderableDefinition) {
      let l = target.lazyRenderableList.push({ id: renderable });
      renderableDefinition = target.lazyRenderableList[l-1];
    }

    renderableDefinition.fullscreen = true;
  },


  override: function(layoutOptions) {

    return function(target, renderable, properties) {
      if (!target.lazyRenderableList) target.lazyRenderableList = [];
      let renderableDefinition = _getRenderableDefinition.call(target, renderable);
      if (!renderableDefinition) {
        let l = target.lazyRenderableList.push({ id: renderable });
        renderableDefinition = target.lazyRenderableList[l-1];
      }

      renderableDefinition.overrideLayout = layoutOptions;
    }
  },

  dock: function(dock) {

    return function(target, renderable, properties) {
      if (dock != 'top' && dock != 'bottom' && dock != 'left' && dock != 'right') {
        console.warn('dock instruction for renderable is not identified. Skipping rendering.');
      }
      else {
        if (!target.lazyRenderableList) target.lazyRenderableList = [];
        let renderableDefinition = _getRenderableDefinition.call(target, renderable);
        if (!renderableDefinition) {
          let l = target.lazyRenderableList.push({ id: renderable });
          renderableDefinition = target.lazyRenderableList[l-1];
        }

        renderableDefinition.dock = dock;
        //renderableDefinition.order = order;
      }
    }
  },

  size: function(x, y) {
    return function(target, renderable, properties) {
      if (!target.lazyRenderableList) target.lazyRenderableList = [];
      let renderableDefinition = _getRenderableDefinition.call(target, renderable);

      if (!renderableDefinition) {
        let l = target.lazyRenderableList.push({ id: renderable });
        renderableDefinition = target.lazyRenderableList[l-1];
      }

      renderableDefinition.sizeX = x;
      renderableDefinition.sizeY = y;
    }
  },

  /* CLASS Decorators */
  scrollable: function(target, renderable, properties) {
    target.prototype.isScrollable = true;
  },

  fill: function(target, renderable, properties) {
    if (!target.lazyRenderableList) target.lazyRenderableList = [];
    let renderableDefinition = _getRenderableDefinition.call(target, renderable);

    if (!renderableDefinition) {
      let l = target.lazyRenderableList.push({ id: renderable });
      renderableDefinition = target.lazyRenderableList[l-1];
    }
  },

  margins: function(margins) {

    return function(target, renderable, properties) {
      target.prototype.viewMargins = margins;
    }
  }
}
