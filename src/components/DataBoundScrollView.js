/**
 This Source Code is licensed under the MIT license. If a copy of the
 MIT-license was not distributed with this file, You can obtain one at:
 http://opensource.org/licenses/mit-license.html.

 @author: Hans van den Akker (mysim1)
 @license MIT
 @copyright Bizboard, 2015

 */

import _                from 'lodash';
import FlexScrollView   from 'famous-flex/src/FlexScrollView.js';
import {ObjectHelper}   from 'arva-utils/ObjectHelper.js';
import {Throttler}      from 'arva-utils/Throttler.js';


export class DataBoundScrollView extends FlexScrollView {

    constructor(OPTIONS = {}) {
        super(_.extend({
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
            }
        }, OPTIONS));
        ObjectHelper.bindAllMethods(this, this);

        this.isGrouped = this.options.groupBy != null;
        this.isDescending = this.options.sortingDirection === 'descending';
        this.throttler = new Throttler(this.options.throttleDelay, true, this);

        /* If no orderBy method is set, or it is a string field name, we set our own ordering method. */
        if (this.options.orderBy && typeof this.options.orderBy === 'string') {
            let fieldName = this.options.orderBy || 'id';
            this.options.orderBy = function (currentChild, compareChild) {
                if (this.isDescending) {
                    return currentChild[fieldName] > compareChild.data[fieldName];
                } else {
                    return currentChild[fieldName] < compareChild.data[fieldName];
                }
            }.bind(this);
        }

        /* If present in options.headerTemplate or options.placeholderTemplate, we build the header and placeholder elements. */
        this._addHeader();
        this._addPlaceholder();

        if (this.options.dataStore) {
            this._bindDataSource(this.options.dataStore);
        } else {
            console.log('No DataSource was set.');
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

    setGroupTemplate(templateFunction = {},reRender = false){
        this.options.groupTemplate = templateFunction;

        if(reRender){
            this.clearDataSource();
            this.reloadFilter(this.options.dataFilter);
        }
    }

    setDataStore(dataStore) {
        if (this.options.dataStore) {
            this.clearDataSource();
        }
        this.options.dataStore = dataStore;
        this._bindDataSource(this.options.dataStore);
    }

    /**
     * Reloads the dataFilter option of the DataBoundScrollView, and verifies whether the items in the dataStore are allowed by the new filter.
     * It removes any currently visible items that aren't allowed anymore, and adds any non-visible ones that are allowed now.
     * @param {Function} newFilter New filter function to verify item visibility with.
     * @param {Boolean} reRender Boolean to rerender all childs that pass the filter function. Usefull when setting a new itemTemplate alongside reloading the filter
     * @returns {void}
     */
    reloadFilter(newFilter) {
        this.options.dataFilter = newFilter;

        for (let entry of this.options.dataStore || []) {
            let surface = _.find(this._dataSource, (surface) => surface.dataId === entry.id);
            let alreadyExists = surface !== undefined;
            let result = newFilter(entry);

            if (result instanceof Promise) {
                result.then(function (shouldShow) {
                    this._handleNewFilterResult(shouldShow, alreadyExists, entry);
                }.bind(this))
            } else {
                this._handleNewFilterResult(result, alreadyExists, entry);
            }
        }
    }

    /**
     * Clears the dataSource by removing all entries
     */
    clearDataSource() {
        for (let entry of this.options.dataStore || []) {
            this._removeItem(entry);
        }
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
        return _.findIndex(this._dataSource, function (surface) {
            return surface.groupId === groupId;
        });
    }

    _findNextGroup(fromIndex) {
        let dslength = this._dataSource.length;
        for (let pos = fromIndex; pos < dslength; pos++) {
            if (this._dataSource[pos].groupId) {
                return pos;
            }
        }

        return this._dataSource.length;
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

        this.insert(insertIndex, newSurface);
    }

    _getInsertIndex(child, previousSiblingID = null) {
        /* By default, add item at the end if the orderBy function does not specify otherwise. */
        let firstIndex = this.header ? 1 : 0;
        let insertIndex = this._dataSource.length;
        let placedWithinGroup = false;

        if (this.isGrouped) {
            let groupId = this._getGroupByValue(child);
            let groupIndex = this._findGroup(groupId);
            if (groupIndex !== -1) {
                for (insertIndex = groupIndex + 1; insertIndex < this._dataSource.length; insertIndex++) {
                    if(this._dataSource[insertIndex].groupId !== undefined ||
                        (this.options.orderBy && this.options.orderBy(child, this._dataSource[insertIndex]))) {
                        break;
                    }
                }
                placedWithinGroup = true;
            }
        }


        if (!placedWithinGroup) {
            /* If we have an orderBy function, find the index we should be inserting at. */
            if (this.options.orderBy && typeof this.options.orderBy === 'function') {
                let foundOrderedIndex = _.findIndex(this._dataSource, function (compareChild) {

                    /* Ignore the header and placeholder items and group headers*/
                    if (!compareChild.isHeader && !compareChild.isPlaceholder && compareChild.groupId === undefined) {
                        return this.options.orderBy(child, compareChild);
                    }
                    return false;
                }.bind(this));

                if (foundOrderedIndex !== -1) {
                    insertIndex = foundOrderedIndex;
                    if (this.isGrouped) {

                        if (this._dataSource[insertIndex] && this._dataSource[insertIndex].groupId === undefined) {
                            for (; this._dataSource[insertIndex].groupId === undefined; insertIndex--);
                        }

                    }
                }
                /*
                 There is no guarantee of order when grouping objects unless orderBy is explicitly defined
                 */
            } else if (previousSiblingID !== undefined) {
                /* We don't have an orderBy method, but do have a previousSiblingID we can use to find the correct insertion index. */
                let siblingIndex = _.findIndex(this._dataSource, (sibling) => sibling.dataId === previousSiblingID);
                if (siblingIndex !== -1) {
                    insertIndex = siblingIndex + 1;
                }
            }
        }

        return insertIndex;
    }

    _addItem(child, previousSiblingID) {
        if (_.findIndex(this._dataSource, (dataItem) => dataItem.dataId === child.id) !== -1) {
            /* Child already exists, so we won't add it again. */
            return;
        }

        this._removePlaceholder();

        let insertIndex = this._getInsertIndex(child, previousSiblingID);

        /* If we're using groups, check if we need to insert a group item before this child. */
        if (this.isGrouped) {
            let groupByValue = this._getGroupByValue(child);
            let groupIndex = this._findGroup(groupByValue);
            if (groupIndex === -1) {
                /* No group of this value exists yet, so we'll need to create one. */
                this._addGroupItem(groupByValue, insertIndex);
                insertIndex++;
            }
        }

        let newSurface = this.options.itemTemplate(child);
        newSurface.dataId = child.id;
        newSurface.data = child;
        this._subscribeToClicks(newSurface, child);

        this.insert(insertIndex, newSurface);

    }

    insert(insertIndex, newSurface){
        /* Dirty fix due to bug in famous-flex 0.3.5. https://github.com/Bizboard/arva-js/issues/8 */
        if(insertIndex === 0 && this._dataSource.length > 0){
            super.insert(1, newSurface);
            this.swap(0, 1);
        } else {
            super.insert(insertIndex, newSurface);
        }
    }



    _replaceItem(child) {
        let index = this._getDataSourceIndex(child.id);

        let newSurface = this.options.itemTemplate(child);
        newSurface.dataId = child.id;
        newSurface.data = child;
        this._subscribeToClicks(newSurface, child);
        this.replace(index, newSurface);
    }


    /**
     * Returns true if the child at index would be the only child in it's group
     * @private
     */
    _isEmptyGroupAtIndex(index) {
        /*
         If there's a group element immediately before, and the element was the last
         in _dataSource
         */
        return (this._dataSource[index - 1] && this._dataSource[index - 1].groupId !== undefined) &&
            (!this._dataSource[index] || this._dataSource[index].groupId !== undefined);
    }

    _removeItem(child) {
        let index = _.findIndex(this._dataSource, function (surface) {
            return surface.dataId === child.id;
        });

        if (index > -1) {
            this.remove(index);
        }

        /* If we're using groups, check if we need to remove the group that this child belonged to. */
        if (this.isGrouped) {
            let groupByValue = this._getGroupByValue(child);


            if (this._isEmptyGroupAtIndex(index)) {

                /* No more childs in this group, so let's remove the group. */
                let groupIndex = this._findGroup(groupByValue);
                if (groupIndex !== -1) {
                    this.remove(groupIndex);
                }
            }
        }

        /* The amount of items in the dataSource is subtracted with a header if present, to get the total amount of actual items in the scrollView. */
        let itemCount = this._dataSource.length - (this.header ? 1 : 0);
        if (itemCount === 0) {
            this._addPlaceholder();
        }
    }


    _moveItem(oldId, prevChildId = null) {

        let oldIndex = this._getDataSourceIndex(oldId);
        let previousSiblingIndex = this._getNextVisibleIndex(prevChildId);

        if (oldIndex !== previousSiblingIndex) {
            this.move(oldIndex, previousSiblingIndex);
        }
    }

    _addHeader() {
        if (this.options.headerTemplate && !this.header) {
            this.header = this.options.headerTemplate();
            this.header.isHeader = true;
            this.insert(0, this.header);
        }
    }

    _addPlaceholder() {
        if (this.options.placeholderTemplate && !this.placeholder) {
            let insertIndex = this.header ? 1 : 0;
            this.placeholder = this.options.placeholderTemplate();
            this.placeholder.dataId = this.placeholder.id = '_placeholder';
            this.placeholder.isPlaceholder = true;
            this.insert(insertIndex, this.placeholder);
        }
    }

    _removePlaceholder() {
        if (this.placeholder) {
            this._removeItem(this.placeholder);
            this.placeholder = null;
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

        this.options.dataStore.on('child_added', this._onChildAdded.bind(this));
        this.options.dataStore.on('child_changed', this._onChildChanged.bind(this));
        this.options.dataStore.on('child_moved', this._onChildMoved.bind(this));
        this.options.dataStore.on('child_removed', this._onChildRemoved.bind(this));

        this._eventInput.on('recursiveReflow', this._reflowOnce);

    }

    _reflowOnce() {
        this.reflowLayout();
        this._eventInput.removeListener('recursiveReflow', this._reflowOnce);
    }


    _onChildAdded(child, previousSiblingID) {
        if (this.options.dataFilter &&
            (typeof this.options.dataFilter === 'function')) {

            let result = this.options.dataFilter(child);

            if (result instanceof Promise) {
                /* If the result is a Promise, show the item when that promise resolves. */
                result.then((show) => {
                    if (show) {
                        this.throttler.add(() => {
                            this._addItem(child, previousSiblingID)
                        });
                    }
                });
            } else if (result) {
                /* The result is an item, so we can add it directly. */
                this.throttler.add(() => {
                    this._addItem(child, previousSiblingID);
                });
            }
        } else {
            /* There is no dataFilter method, so we can add this child. */
            this.throttler.add(() => {
                this._addItem(child, previousSiblingID);
            });
        }
    }

    _onChildChanged(child, previousSiblingID) {
        let changedItemIndex = this._getDataSourceIndex(child.id);

        if (this._dataSource && changedItemIndex < this._dataSource.length) {

            let result = this.options.dataFilter(child);

            if (result instanceof Promise) {
                result.then(function (show) {
                    if (show) {
                        this.throttler.add(() => {
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
                    this.throttler.add(() => {
                        this._addItem(child, previousSiblingID);
                    });
                } else {
                    this.throttler.add(() => {
                        this._replaceItem(child);
                        if (previousSiblingID && !this.useCustomOrdering) {
                            this._moveItem(child.id, previousSiblingID);
                        }
                    });
                }
            }
        }
    }

    _onChildMoved(child, previousSiblingID) {
        let current = this._getDataSourceIndex(child.id);
        this.throttler.add(() => {
            this._moveItem(current, previousSiblingID);
        });
    }

    _onChildRemoved(child) {
        this.throttler.add(() => {
            this._removeItem(child);
        });
    };

    _getDataSourceIndex(id) {
        return _.findIndex(this._dataSource, function (surface) {
            return surface.dataId === id;
        });
    }


    _getNextVisibleIndex(id) {

        let viewIndex = this._getDataSourceIndex(id);
        if (viewIndex === -1) {
            let modelIndex = _.findIndex(this.options.dataStore, function (model) {
                return model.id === id;
            });

            if (modelIndex === 0 || modelIndex === -1) {
                return this.isDescending ? this._dataSource ? this._dataSource.length - 1 : 0 : 0;
            } else {
                let nextModel = this.options.dataStore[this.isDescending ? modelIndex + 1 : modelIndex - 1];
                let nextIndex = this._getDataSourceIndex(nextModel.id);
                if (nextIndex > -1) {

                    return this.isDescending ? nextIndex === 0 ? 0 : nextIndex - 1 :
                        this._dataSource.length === nextIndex + 1 ? nextIndex : nextIndex + 1;
                } else {
                    return this._getNextVisibleIndex(nextModel.id);
                }
            }
        } else {
            return this.isDescending ? viewIndex === 0 ? 0 : viewIndex - 1 :
                this._dataSource.length === viewIndex + 1 ? viewIndex : viewIndex + 1;
        }
    }

    _subscribeToClicks(surface, model) {
        surface.on('click', function () {
            this._eventOutput.emit('child_click', {renderNode: surface, dataObject: model});
        }.bind(this));
    }
}
