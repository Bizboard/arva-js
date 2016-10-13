/**
 This Source Code is licensed under the MIT license. If a copy of the
 MIT-license was not distributed with this file, You can obtain one at:
 http://opensource.org/licenses/mit-license.html.

 @author: Hans van den Akker (mysim1)
 @license MIT
 @copyright Bizboard, 2015

 */

import sortBy                       from 'lodash/sortBy.js';
import findIndex                    from 'lodash/findIndex.js';
import {Throttler}                  from '../utils/Throttler.js';
import {combineOptions}             from '../utils/CombineOptions.js';
import {ReflowingScrollView}        from './ReflowingScrollView.js';
import {ScrollController}           from '../core/ScrollController.js';
import Timer                        from 'famous/utilities/Timer.js';

/**
 * A FlexScrollView with enhanced functionality for maintaining a two-way connection with a PrioritisedArray.
 */
export class DataBoundScrollView extends ScrollController {


    /**
     * Be sure to specifiy either a getSize function in the class of the itemTemplate, or to specify the size in the
     * layoutOptions.
     *
     * @param {Object} options The options passed inherit from previous classes. Avoid using the dataSource option since
     * the DataBoundScrollView creates its own dataSource from options.dataStore.
     * @param {PrioriisedArray} [options.dataStore] The data that should be read to create entries.
     * @param {Function} [options.itemTemplate] A function that returns a renderable representing each data item.
     * @param {Function} [options.placeholderTemplate] A function that returns a renderable to display when there are
     * no items present.
     * @param {Function} [options.headerTemplate] A function that returns a renderable to display as a header.
     * @param {Function} [options.orderBy] An ordering function that takes two data models (model1, model2).
     * If it returns true, then model1 should go before model2.
     * @param {Function} [options.groupBy] A function that takes a model and returns a value to group by. If set, then
     * the groupTemplate option also needs to be set.
     * @param {Function} [options.groupTemplate] A function that takes as a single argument the groupBy value and returns
     * a renderable to insert before a group belonging to that value.
     * @param {Boolean} [options.stickHeaders] If set to true, then the group headers will stick to the top when scrolling.
     * Beware that this is slightly buggy as of now and might require some fine tuning to provide a better UX.
     * @param {Function} [options.customInsertSpec] A function that takes as a single argument a model and returns a spec
     * that is used when inserting a new item.
     * @param {Boolean} [options.chatScrolling] If set to true, the scroll will remain at the bottom if at bottom already
     * when new messages are added.
     *
     * If this function returns true, then model1 will be placed before model2.
     *
     */
    constructor(options = {}) {
        super(combineOptions({
            scrollFriction: {
                strength: 0.0015
            },
            autoPipeEvents: true,
            throttleDelay: 0, /* If set to 0, no delay is added in between adding items to the DataBoundScrollView. */
            dataSource: [],
            sortingDirection: 'ascending',
            flow: true,
            flowOptions: {
                spring: {               // spring-options used when transitioning between states
                    dampingRatio: 0.8,  // spring damping ratio
                    period: 1000        // duration of the animation
                },
                insertSpec: {           // render-spec used when inserting renderables
                    opacity: 0          // start opacity is 0, causing a fade-in effect,
                }
            },
            dataFilter: ()=> true,
            ensureVisible: null,
            layoutOptions: {
                isSectionCallback: options.stickyHeaders ? function (renderNode) {
                    return renderNode.groupId !== undefined;
                } : undefined
            },
            chatScrolling: false
        }, options));

        this._internalDataSource = {};
        this._internalGroups = {};
        this._isGrouped = this.options.groupBy != null;
        this._isDescending = this.options.sortingDirection === 'descending';
        this._throttler = new Throttler(this.options.throttleDelay, true, this);
        this._useCustomOrdering = !!this.options.orderBy;
        /* If no orderBy method is set, or it is a string field name, we set our own ordering method. */
        if (!this.options.orderBy || typeof this.options.orderBy === 'string') {
            let fieldName = this.options.orderBy || 'id';
            this.options.orderBy = function (currentChild, {model}) {
                if (this._isDescending) {
                    return currentChild[fieldName] > model[fieldName];
                } else {
                    return currentChild[fieldName] < model[fieldName];
                }
            }.bind(this);
        }


        /* If present in options.headerTemplate or options.placeholderTemplate, we build the header and placeholder elements. */
        this._addHeader();
        this._addPlaceholder();


        if (this.options.dataStore) {
            this._bindDataSource(this.options.dataStore);
        }
    }

    /**
     * Set a template function, optionally re-renders all the dataSource' renderables
     * @param templateFunction
     */
    setItemTemplate(templateFunction = {}, reRender = false) {
        this.options.itemTemplate = templateFunction;

        if (reRender) {
            this.clearDataSource();
            this.reloadFilter(this.options.dataFilter);
        }
    }

    /**
     * Sets a group template function, optionally re-renders all the dataSource' renderables.
     * @param templateFunction
     * @param reRender
     */
    setGroupTemplate(templateFunction = {}, reRender = false) {
        this.options.groupTemplate = templateFunction;

        if (reRender) {
            this.clearDataSource();
            this.reloadFilter(this.options.dataFilter);
        }
    }

    /**
     * Sets the datastore to use. This will repopulate the view and remove any (if present) old items.
     * @param dataStore
     */
    setDataStore(dataStore) {
        if (this.options.dataStore) {
            this.clearDataSource();
        }
        this.options.dataStore = dataStore;
        this._bindDataSource(this.options.dataStore);
    }

    /**
     * Gets the currently set dataStore.
     * @returns {*}
     */
    getDataStore() {
        return this.options.dataStore;
    }

    /**
     * Reloads the dataFilter option of the DataBoundScrollView, and verifies whether the items in the dataStore are allowed by the new filter.
     * It removes any currently visible items that aren't allowed anymore, and adds any non-visible ones that are allowed now.
     * @param {Function} newFilter New filter function to verify item visibility with.
     * @param {Boolean} reRender Boolean to rerender all childs that pass the filter function. Usefull when setting a new itemTemplate alongside reloading the filter
     * @returns {Promise} Resolves when filter has been applied
     */
    reloadFilter(newFilter) {
        this.options.dataFilter = newFilter;

        let filterPromises = [];
        for (let entry of this.options.dataStore || []) {
            let alreadyExists = this._internalDataSource[entry.id] !== undefined;
            let result = newFilter(entry);

            if (result instanceof Promise) {
                filterPromises.push(result);
                result.then(function (shouldShow) {
                    this._handleNewFilterResult(shouldShow, alreadyExists, entry);
                }.bind(this))
            } else {
                this._handleNewFilterResult(result, alreadyExists, entry);
            }
        }
        return Promise.all(filterPromises);
    }

    /**
     * Clears the dataSource by removing all entries
     */
    clearDataSource() {
        for (let entry of this.options.dataStore || []) {
            this._removeItem(entry);
        }
    }

    
    

    /**
     * Returns the currently active group elements, or an empty object of none are present.
     * @returns {Object}
     */
    getGroups() {
        return this._internalGroups || {};
    }


    _addHeader() {
        if (this.options.headerTemplate) {
            this._header = this.options.headerTemplate();
            this._header.isHeader = true;
            this._insertId(0, 0, this._header, null, {isHeader: true});
            this.insert(0, this._header);
        }
    }

    /**
     * @private
     * Patch because Hein forgot to auto pipe events when replacing
     * @param indexOrId
     * @param renderable
     * @param noAnimation
     */
    _replace(indexOrId, renderable, noAnimation) {
        super.replace(indexOrId, renderable, noAnimation);
    }

    _handleNewFilterResult(shouldShow, alreadyExists, entry) {
        if (shouldShow) {
            /* This entry should be in the view, add it if it doesn't exist yet. */
            if (!alreadyExists) {
                this._addItem(entry);
            }
        } else {
            /* This entry should not be in the view, remove if present. */
            if (alreadyExists) {
                this._removeItem(entry);
            }
        }
    }

    _findGroup(groupId) {
        return this._internalGroups[groupId] || -1;
    }

    _getGroupByValue(child) {
        let groupByValue = '';
        if (typeof this.options.groupBy === 'function') {
            groupByValue = this.options.groupBy(child);
        } else if (typeof this.options.groupBy === 'string') {
            groupByValue = this.options.groupBy;
        }
        return groupByValue;
    }

    _addGroupItem(groupByValue, insertIndex) {
        let newSurface = this.options.groupTemplate(groupByValue);
        newSurface.groupId = groupByValue;
        this._internalGroups[groupByValue] = {position: insertIndex, itemsCount: 0};
        this.insert(insertIndex, newSurface);

        return newSurface;
    }


    _getInsertIndex(child, previousSiblingID = undefined) {
        /* By default, add item at the end if the orderBy function does not specify otherwise. */
        let firstIndex = this._getZeroIndex();
        let insertIndex = this._dataSource.getLength();
        let placedWithinGroup = false;

        if (this._isGrouped) {
            let groupIndex;
            let groupId = this._getGroupByValue(child);
            let groupData = this._findGroup(groupId);
            if (groupData) groupIndex = groupData.position;
            if (groupIndex != undefined && groupIndex !== -1) {
                for (insertIndex = groupIndex + 1; insertIndex <= (groupIndex + groupData.itemsCount); insertIndex++) {
                    if (this.options.orderBy) {
                        let dataId = this._viewSequence.findByIndex(insertIndex)._value.dataId;
                        if (dataId && this.options.orderBy(child, this._internalDataSource[dataId])) {
                            break;
                        }
                    } else {
                        insertIndex += this._internalGroups[groupId].itemsCount;
                        break;
                    }
                }
                placedWithinGroup = true;
            }
        }

        if (!placedWithinGroup) {
            /* If we have an orderBy function, find the index we should be inserting at. */
            if ((this._useCustomOrdering && this.options.orderBy && typeof this.options.orderBy === 'function') || this._isGrouped) {
                let foundOrderedIndex = -1;
                if (this._isGrouped) {

                    for (let group of sortBy(this._internalGroups, 'position')) {
                        /* Check the first and last item of every group (they're sorted) */
                        for (let position of group.itemsCount > 1 ? [group.position + 1, group.position + group.itemsCount - 1] : [group.position + 1]) {
                            let {dataId} = this._viewSequence.findByIndex(position)._value;
                            if (this.options.orderBy(child, this._internalDataSource[dataId])) {
                                foundOrderedIndex = group.position;
                                break;
                            }
                        }
                        if (foundOrderedIndex > -1) {
                            break;
                        }
                    }
                } else {
                    foundOrderedIndex = this._orderBy(child, this.options.orderBy);
                }

                if (foundOrderedIndex !== -1) {
                    insertIndex = foundOrderedIndex;
                }
                /*
                 There is no guarantee of order when grouping objects unless orderBy is explicitly defined
                 */
            } else if (previousSiblingID !== undefined && previousSiblingID != null) {
                /* We don't have an orderBy method, but do have a previousSiblingID we can use to find the correct insertion index. */
                let siblingIndex = this._findData(previousSiblingID).position;
                if (siblingIndex !== -1) {
                    insertIndex = siblingIndex + 1;
                }
            }
        }

        return insertIndex;
    }

    _insertGroup(insertIndex, groupByValue) {
        let groupIndex = this._findGroup(groupByValue);
        if (groupByValue) {
            let groupExists = groupIndex !== -1;
            if (!groupExists) {
                /* No group of this value exists yet, so we'll need to create one. */
                this._updatePosition(insertIndex, 1);
                let newSurface = this._addGroupItem(groupByValue, insertIndex);
                this._insertId(`group_${groupByValue}`, insertIndex, newSurface, null, {groupId: groupByValue});
                /*insertIndex++;*/
            }
            return !groupExists;
        }
        return null;
    }


    async _addItem(child, previousSiblingID = undefined) {

        if (this._findData(child.id)) {
            console.log('Child already exists ', child.id);
            return;
        }

        this._removePlaceholder();

        let insertIndex = this._getInsertIndex(child, previousSiblingID);

        /* If we're using groups, check if we need to insert a group item before this child. */
        if (this._isGrouped) {
            let groupByValue = this._getGroupByValue(child);

            if (this._insertGroup(insertIndex, groupByValue)) {
                /* If a new group is inserted, then increase the insert index */
                insertIndex++;
            }
            /* Increase the count of the number of items in the group */
            this._internalGroups[groupByValue].itemsCount++;
        }

        let newSurface = this.options.itemTemplate(child);
        if(newSurface instanceof Promise) {
            newSurface = await newSurface;
        }

        newSurface.dataId = child.id;
        this._subscribeToClicks(newSurface, child);

        /* If we're scrolling as with a chat window, then scroll to last child if we're at the bottom */
        if (this.options.chatScrolling && insertIndex === this._dataSource.getLength()) {
            if (this.isAtBottom() || !this._allChildrenAdded) {
                this._lastChild = child;
            }
        }
        let insertSpec;
        if(this.options.customInsertSpec){
            insertSpec = this.options.customInsertSpec(child);
        }

        this.insert(insertIndex, newSurface, insertSpec);
        this._updatePosition(insertIndex);
        this._insertId(child.id, insertIndex, newSurface, child);

        if (this.options.ensureVisible != null || this.options.chatScrolling) {
            let shouldEnsureVisibleUndefined = this.options.ensureVisible == null;
            let shouldEnsureVisible = !shouldEnsureVisibleUndefined ? this.options.ensureVisible(child, newSurface, insertIndex) : false;
            if (this.options.chatScrolling) {
                if (child === this._lastChild && (shouldEnsureVisible || shouldEnsureVisibleUndefined)) {
                    this.stickToBottom();
                }
            } else if (shouldEnsureVisible) {
                this.ensureVisible(newSurface);
            }
        }
    }

    _replaceItem(child) {
        let index = this._findData(child.id).position;

        let newSurface = this.options.itemTemplate(child);
        newSurface.dataId = child.id;
        this._subscribeToClicks(newSurface, child);
        this._insertId(child.id, index, newSurface, child);
        this._replace(index, newSurface, true);
    }

    _removeGroupIfNecessary(groupByValue) {
        /* Check if the group corresponding to the child is now empty */
        let group = this._internalGroups[groupByValue];
        if (group && group.itemsCount === 0) {
            /* TODO: Maybe remove internalgroups[groupByValue]? (Or not?) */
            let {position} = group;
            this._updatePosition(position, -1);
            this.remove(position);
            delete this._internalGroups[groupByValue];
            delete this._internalDataSource[groupByValue];
        }

    }


    _removeItem(child) {
        let internalChild = this._internalDataSource[child.id] || {};
        let index = internalChild.position;
        if (index > -1) {
            this._updatePosition(index, -1);
            this.remove(index);
            delete this._internalDataSource[child.id];
        }

        /* If we're using groups, check if we need to remove the group that this child belonged to. */
        if (this._isGrouped) {
            let groupByValue = this._getGroupByValue(child);
            let group = this._internalGroups[groupByValue];
            if(group){ group.itemsCount--; }


            this._removeGroupIfNecessary(groupByValue);

        }

        /* The amount of items in the dataSource is subtracted with a header if present, to get the total amount of actual items in the scrollView. */
        let itemCount = this._dataSource.getLength() - (this._getZeroIndex());
        if (itemCount === 0) {
            this._addPlaceholder();
        }
    }

    _moveItem(oldId, prevChildId = null) {

        let oldData = this._findData(oldId);
        let oldIndex = oldData.position;

        let previousSiblingIndex = this._getNextVisibleIndex(prevChildId);
        if (oldIndex !== previousSiblingIndex) {
            this.move(oldIndex, previousSiblingIndex);
            this._internalDataSource[previousSiblingIndex] = oldData;
            this._internalDataSource[previousSiblingIndex].position = oldIndex;
        }
    }


    _removeHeader() {
        if (this._header) {
            this.remove(0);
            delete this._internalDataSource[0];
            this._header = null;
        }
    }

    _addPlaceholder() {
        if (this.options.placeholderTemplate && !this._placeholder) {
            let insertIndex = this._getZeroIndex();
            this._placeholder = this.options.placeholderTemplate();
            this._placeholder.isPlaceholder = true;
            this.insert(insertIndex, this._placeholder);
        }
    }

    _getZeroIndex() {
        return this._header ? 2 : 1;
    }

    _removePlaceholder() {
        if (this._placeholder) {
            if (this._placeholder)
                this.remove(this._getZeroIndex());
            this._placeholder = null;
        }
    }

    _bindDataSource() {

        if (!this.options.dataStore || !this.options.itemTemplate) {
            console.log('Datasource and template should both be set.');
            return;
        }

        if (!this.options.template instanceof Function) {
            console.log('Template needs to be a function.');
            return;
        }
        if (this.options.chatScrolling) {
            this.options.dataStore.on('ready', () => this._allChildrenAdded = true);
        }


        this.options.dataStore.on('child_added', this._onChildAdded.bind(this));
        this.options.dataStore.on('child_changed', this._onChildChanged.bind(this));
        this.options.dataStore.on('child_moved', this._onChildMoved.bind(this));
        this.options.dataStore.on('child_removed', this._onChildRemoved.bind(this));
    }


    _onChildAdded(child, previousSiblingID) {
        if (this.options.dataFilter &&
            (typeof this.options.dataFilter === 'function')) {

            let result = this.options.dataFilter(child);

            if (result instanceof Promise) {
                /* If the result is a Promise, show the item when that promise resolves. */
                result.then((show) => {
                    if (show) {
                        this._throttler.add(() => {
                            this._addItem(child, previousSiblingID)
                        });
                    }
                });
            } else if (result) {
                /* The result is an item, so we can add it directly. */
                this._throttler.add(() => {
                    this._addItem(child, previousSiblingID);
                });
            }
        } else {
            /* There is no dataFilter method, so we can add this child. */
            this._throttler.add(() => {
                this._addItem(child, previousSiblingID);
            });
        }
    }

    _onChildChanged(child, previousSiblingID) {
        let changedItemIndex = this._getDataSourceIndex(child.id);

        if (this._dataSource && changedItemIndex < this._dataSource.getLength()) {

            let result = this.options.dataFilter ? this.options.dataFilter(child) : true;

            if (result instanceof Promise) {
                result.then(function (show) {
                    if (show) {
                        this._throttler.add(() => {
                            this._replaceItem(child);
                        });
                    } else {
                        this._removeItem(child);
                    }
                }.bind(this));
            }
            else if (this.options.dataFilter &&
                typeof this.options.dataFilter === 'function' && !result) {
                this._removeItem(child);
            } else {
                if (changedItemIndex === -1) {
                    this._throttler.add(() => {
                        this._addItem(child, previousSiblingID);
                    });
                } else {
                    this._throttler.add(() => {
                        this._replaceItem(child);
                        if (previousSiblingID && !this._isGrouped && !this._useCustomOrdering) {
                            this._moveItem(child.id, previousSiblingID);
                        }
                    });
                }
            }
        }
    }

    _onChildMoved(child, previousSiblingID) {
        let current = this._getDataSourceIndex(child.id);
        this._throttler.add(() => {
            this._moveItem(current, previousSiblingID);
        });
    }

    _onChildRemoved(child) {
        this._throttler.add(() => {
            this._removeItem(child);
        });
    };

    _getDataSourceIndex(id) {
        let data = this._findData(id);
        return data ? data.position : -1;
    }

    _getNextVisibleIndex(id) {
        let viewIndex = -1;
        let viewData = this._findData(id);

        if (viewData) {
            viewIndex = viewData.position
        }

        if (viewIndex === -1) {

            let modelIndex = findIndex(this.options.dataStore, function (model) {
                return model.id === id;
            });

            if (modelIndex === 0 || modelIndex === -1) {
                return this._isDescending ? this._dataSource ? this._dataSource.getLength() - 1 : 0 : 0;
            } else {
                let nextModel = this.options.dataStore[this._isDescending ? modelIndex + 1 : modelIndex - 1];
                let nextIndex = this._findData(nextModel.id).position;
                if (nextIndex > -1) {
                    return this._isDescending ? nextIndex === 0 ? 0 : nextIndex - 1 :
                        this._dataSource.getLength() === nextIndex + 1 ? nextIndex : nextIndex + 1;
                } else {
                    return this._getNextVisibleIndex(nextModel.id);
                }
            }
        } else {
            return this._isDescending ? viewIndex === 0 ? 0 : viewIndex - 1 :
                this._dataSource.getLength() === viewIndex + 1 ? viewIndex : viewIndex + 1;
        }
    }

    _orderBy(child, orderByFunction) {
        let item = this._dataSource._.head;
        let index = 0;

        while (item) {
            if (item._value.dataId && this._internalDataSource[item._value.dataId] && orderByFunction(child, this._internalDataSource[item._value.dataId])) {
                return index;
            }

            index++;
            item = item._next;
        }
        return -1;
    }

    _updatePosition(position, change = 1) {
        if (position === undefined || position === this._dataSource.getLength() - 1) return;
        for (let element of Object.keys(this._internalDataSource)) {
            let dataObject = this._internalDataSource[element];
            if (dataObject.position >= position) {
                dataObject.position += change
            }
        }
        if (this._isGrouped) {
            this._updateGroupPosition(position, change);
        }
    }

    _updateGroupPosition(position, change = 1) {
        for (let element of Object.keys(this._internalGroups)) {
            if (this._internalGroups[element].position >= position) {
                /* Update the position of groups coming after */
                this._internalGroups[element].position += change;
            }
        }
    }

    _findData(id) {
        let data = this._internalDataSource[id] || undefined;
        return data;
    }

    _insertId(id = null, position, renderable = {}, model = {}, options = {}) {
        if (id === undefined || id === null) return;

        this._internalDataSource[id] = {position: position, renderable: renderable, model: model};
        for (let element of Object.keys(options)) {
            this._internalDataSource[id][element] = options[element];
        }
    }

    _subscribeToClicks(surface, model) {
        surface.on('click', function () {
            this._eventOutput.emit('child_click', {renderNode: surface, dataObject: model});
        }.bind(this));
    }
}
