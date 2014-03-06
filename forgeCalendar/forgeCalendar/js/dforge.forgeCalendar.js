//////////////////////////////////////////////////////////
// Calendar Plugin version 1.0
// https://github.com/DigitForge/forgeCalendar
//
// Copyright 2014, DigitForge Enterprises LLC
//
// Licensed under the MIT licensw
// http://www.opensource.org/licenses/MIT
//
//////////////////////////////////////////////////////////
// Calendar
// A quick and easy calendar generator. You feed it items
// and it spits out a calendar.
//////////////////////////////////////////////////////////
(function ($) {

    //Attatch the new method		   
    jQuery.fn.extend({

        //Plugin 
        forgeCalendar: function (options) {

            // Forge Calendar Event
            function FCEvent(item, options, isBusy) {
                this.options = options;
                this.item = item;
                this._event = null;
                this.isBusy = isBusy == null || isBusy;
                this.conflicts = []; // other events that this event conflicts with
            };
            FCEvent.prototype.start = function () {
                if (this.item == null)
                    return null;
                if (this._event == null)
                    this.momentize();
                return this._event.start;
            };
            FCEvent.prototype.end = function () {
                if (this.item == null)
                    return null;
                if (this._event == null)
                    this.momentize();
                return this._event.end;
            };
            FCEvent.prototype.duration = function () {
                if (this.item == null)
                    return null;
                if (this._event == null)
                    this.momentize();
                return this._event.duration;
            };
            FCEvent.prototype.momentize = function () {
                if (this.item == null)
                    return;
                this._event = {
                    start: null,
                    end: null,
                    duration: null,
                };

                var start = this.item[this.options.startPropertyName];
                var end = this.item[this.options.endPropertyName];
                var duration = this.item[this.options.durationPropertyName];
                if (duration != null)
                    this._event.duration = parseInt(duration, 10);

                var moment1 = null;
                if (start != null)
                    moment1 = moment(start);

                var moment2 = null;
                if (end != null)
                    moment2 = moment(end);

                if (moment1 != null && moment2 != null) {
                    if (moment1.isBefore(moment2)) {
                        this._event.start = moment1;
                        this._event.end = moment2;
                    }
                    else {
                        this._event.start = moment2;
                        this._event.end = moment1;
                    }
                }
                else if (moment1 != null && this._event.duration != null) {
                    this._event.start = moment1;
                    this._event.end = moment(moment1).add("minutes", this._event.duration);
                }
                else if (moment2 != null && this._event.duration != null) {
                    this._event.end = moment1;
                    this._event.start = moment(moment1).subtract("minutes", this._event.duration);
                }

                if (this._event.duration == null && this._event.start != null && this._event.end != null)
                    this._event.duration = this._event.end.diff(this._event.start, "minutes");
            };
            FCEvent.prototype.isSameDay = function (date) {
                if (!this.isValid())
                    return false;
                var dateMoment = moment.isMoment(date) ? date : moment(date);
                return this.start().isSame(dateMoment, "year") && this.start().isSame(dateMoment, "month") && this.start().isSame(dateMoment, "day");
            };
            FCEvent.prototype.cast = function (event) {
                return (event instanceof FCEvent) ? event : new FCEvent(event, this.options);
            };
            FCEvent.prototype.isValid = function () {
                return (this.start() != null && this.end() != null && this.duration() != null);
            };
            FCEvent.prototype.isMultiDay = function () {
                return !this.isSameDay(this.end());
            };
            FCEvent.prototype.overlaps = function (event) {
                if(event==null || !this.isValid())
                    return false;
                var fcEvent = this.cast(event);
                if (!fcEvent.isValid())
                    return false;
                return (this.start() < fcEvent.end()) && (this.end() > fcEvent.start());
            };

            // Forge Calendar Controller
            function forgeCalendarController(containerId, options) {
                this.containerId = containerId;
                this.$container = $("#" + containerId);
                this.options = options;
                this.tempDisable = false;
                this.lastWaitOptions = null;

                this.onAction = function (action) {
                    var args = Array.prototype.slice.call(arguments, 1);
                    switch (action) {
                        case "default":
                            return this.onAction(this.options.defaultAction);
                        case "isEnabled":
                            return this.isEnabled();
                        case "enable":
                            return this.disable(false);
                        case "disable":
                            return this.disable(true);
                        case "setOptions":
                            return this.setOptions.apply(this, args);
                        case "showWait":
                            return this.showWait.apply(this, args);
                        case "getFooter":
                            return this.$footerContainer;
                        case "getToolArea":
                            return this.$toolArea;
                        case "getController":
                            return this;
                        case "next":
                            return this.next();
                        case "previous":
                            return this.previous();
                        case "delete":
                            return this.delete.apply(this, args);
                        default:
                            break;
                    }
                }

                // Update the options (forces an update)
                this.setOptions = function (newOptions) {
                    this.options = $.extend(true, {}, this.options, newOptions);
                    this.update();
                }

                // Determines if user interaction is allowed
                this.isEnabled = function () {
                    return this.options.enabled && !this.tempDisable;
                }

                // Disable/Enable user interaction
                this.disable = function (disabled) {
                    this.options.enabled = !disabled;
                }

                // General purpose:
                // Filters items for a given date period
                // dateEnd is optional
                this.filterItems = function (items, dateStart, dateEnd) {
                    var _this = this;

                    var start = moment.isMoment(dateStart) ? dateStart : moment(dateStart);

                    var results = {
                        dateStart: start,
                        dateEnd: dateEnd == null ? moment(start).endOf("day") : moment.isMoment(dateEnd) ? dateEnd : moment(dateEnd),
                        events: [],
                    };

                    if (items != null) {
                        $.each(items, function (i, item) {
                            var event = new FCEvent(item, _this.options.event);
                            if (event.isValid()) {
                                if(results.dateEnd==null && event.isSameDay(results.dateStart))
                                    results.events.push(event);
                                else if (results.dateEnd != null) {
                                    if (
                                        (results.dateStart <= event.start() && results.dateEnd >= event.start()) ||
                                        _this.options.display.allowMultiDay &&
                                            (
                                                (results.dateStart <= event.end() && results.dateEnd >= event.end()) ||
                                                (event.start() <= results.dateStart && event.end() >= results.dateEnd)
                                            )
                                       )
                                    {
                                        results.events.push(event);
                                    }
                                }
                            }
                        });
                    }

                    return results;
                },

                // Sort function by the start date of the event
                this.sortByStartDate = function (a, b) { return a.start().toDate() - b.start().toDate(); }

                // General purpose:
                // Get any conflicting events for the given event
                // If recursive, then any direct conflict plus any "conflicts of the conflict" are returned
                this.getConflicts = function (event, eventsToSearch, recursive) {
                    var _this = this;
                    if (event == null || eventsToSearch == null || eventsToSearch.length == 0)
                        return [];

                    // make a copy of the events to search
                    var eventsRemaining = eventsToSearch.slice(0);

                    var conflicts = [];
                    for (var i = 0; i < eventsToSearch.length;i++) {
                        // take off the first event
                        var directEvent = eventsRemaining.shift();

                        if (directEvent != event && event.overlaps(directEvent) && !_this.eventExistsIn(directEvent, conflicts)) {
                            conflicts.push(directEvent);
                            if (recursive) {
                                var secondaryEvents = _this.getConflicts(directEvent, eventsRemaining, true);
                                $.each(secondaryEvents, function (j, secEvent) {
                                    if (secEvent != event && !_this.eventExistsIn(secEvent, conflicts))
                                        conflicts.push(secEvent);
                                });
                            }
                        }
                    };
                    return conflicts;
                },

                // General purpose
                // Return a list of all events, grouped by those events that conflict with each other                
                this.groupByConflicts = function (events, includeEventsWithoutConflicts) {
                    var _this = this;
                    var groups = [];

                    $.each(events, function (i, event) {

                        // Make sure this event is not already accounted for
                        var exists = false;
                        $.each(groups, function (i, group) {
                            if (_this.eventExistsIn(event, group.conflicts)) {
                                exists = true;
                                return false;
                            }
                        });

                        if (!exists) {
                            // get conflicts (if any)
                            var conflicts = _this.getConflicts(event, events, true);
                            if (conflicts.length > 0 || includeEventsWithoutConflicts) {
                                // add the event to the list of conflicts
                                conflicts.push(event);
                                conflicts.sort(_this.sortByStartDate);

                                // Calculate the start/end summary for the entire group
                                var startOfConflicts = null;
                                var endOfConflicts = null;
                                $.each(conflicts, function (i, conflictEvent) {
                                    if (startOfConflicts == null)
                                        startOfConflicts = conflictEvent.start();
                                    else
                                        startOfConflicts = conflictEvent.start().max(startOfConflicts);
                                    if (endOfConflicts == null)
                                        endOfConflicts = conflictEvent.end();
                                    else
                                        endOfConflicts = conflictEvent.end().min(endOfConflicts);
                                });
                                var summaryItem = {};
                                summaryItem[_this.options.event.startPropertyName] = moment(startOfConflicts);
                                summaryItem[_this.options.event.endPropertyName] = moment(endOfConflicts);
                                var summary = new FCEvent(summaryItem, _this.options.event, true);
                                summary.conflicts = conflicts;
                                // save the summary/conflict group
                                groups.push(summary);
                            }
                        }
                    });

                    groups.sort(this.sortByStartDate);

                    return groups;
                },

                // General Purpose
                // Determine if the given event exists in the list of events passed over
                this.eventExistsIn = function (event, eventArray) {
                    if (event == null || eventArray == null || eventArray.length == 0)
                        return false;
                    for (var i = 0; i < eventArray.length; i++) {
                        if (eventArray[i] === event)
                            return true;
                    }
                    return false;
                }

                // General Purpose
                // Given the passed in events, calculate the optimal placement 
                // necessary to minimize the number of columns needed to display them
                this.packColumns = function (events) {
                    var columns = [];

                    if (events == null || events.length == 0) {
                        // always ensure a single column even if no events exist
                        var newCol = {
                            index: columns.length,
                            events: [],
                        };
                        columns.push(newCol);
                    }
                    else {
                        $.each(events, function (i, event) {

                            // check each column for a non-overlapping space to place this item in
                            var colIndex = -1;
                            $.each(columns, function (j, col) {

                                var hasOverlap = false;
                                $.each(col.events, function (k, colEvent) {
                                    hasOverlap = colEvent.overlaps(event);
                                    if (hasOverlap)
                                        return false;
                                });

                                if (!hasOverlap) {
                                    // Space was found in this column, so add it and stop
                                    colIndex = j;
                                    col.events.push(event);
                                    return false;
                                }
                            });

                            if (colIndex < 0) {
                                // add a new column because no available space was found
                                var newCol = {
                                    index: columns.length,
                                    events: [],
                                };
                                newCol.events.push(event);
                                columns.push(newCol);
                            }
                        });
                    }
                    return columns;
                }

                // Deprecated. Use calcZoneLayout for better fitting events
                // General purpose:
                // Determines the columns used to display any overlapping events
                this.calcColumnLayout = function (events, defaultDate, padToFullDay) {
                    var _this = this;

                    results = {
                        events: [],
                        columns: [],
                    };

                    if (events == null || events.length == 0) {
                        // always ensure a single column even if no events exist
                        var newCol = {
                            index: results.columns.length,
                            events: [],
                        };
                        results.columns.push(newCol);
                    }
                    else {
                        results.events = events;
                        // sort all items
                        results.events.sort(this.sortByStartDate);
                        // pack events into optimal columns
                        results.columns = this.packColumns(results.events);
                    }

                    // For each column, go ahead and calculate the free time
                    $.each(results.columns, function (i, col) {
                        var freeTime = _this.calcFreeTime(col.events, defaultDate, padToFullDay);
                        $.extend(col, freeTime);
                    });

                    return results;
                },

                // General purpose:
                // Determines the zones used to display any overlapping events
                // making sure we maximize the size of all events
                this.calcZoneLayout = function (events, defaultDate, padStart, padEnd) {
                    var _this = this;

                    results = {
                        events: [],
                        groups: [],
                        zones: [],
                    };

                    if (events == null || events.length == 0) {
                        // always ensure a single zone even if no events exist
                        var freeTimeItem = {};
                        freeTimeItem[this.options.event.startPropertyName] = padStart != null ? moment(padStart) : moment(defaultDate).hour(0).minute(0).second(0).millisecond(0);
                        freeTimeItem[this.options.event.endPropertyName] = padEnd != null ? moment(padEnd) : moment(defaultDate).hour(0).minute(0).second(0).millisecond(0).add({ days: 1 }).subtract("seconds", 1);
                        var freeTime = new FCEvent(freeTimeItem, this.options.event, false);

                        var newZone = {
                            index: results.zones.length,
                            isBusy: false,
                            group: freeTime,
                            events: [],
                            columns: _this.packColumns(null),
                        };
                        // For each column, go ahead and calculate the free time
                        $.each(newZone.columns, function (i, col) {
                            var freeTime = _this.calcFreeTime(col.events, defaultDate, true, newZone.group.start(), newZone.group.end());
                            $.extend(col, freeTime);
                        });
                        results.zones.push(newZone);
                    }
                    else {
                        // save the events
                        results.events = events;
                        // Group all the events by their conflicts
                        results.groups = this.groupByConflicts(events, true);
                        // Get the free time to pad out the entire day
                        var paddedEvents = this.calcFreeTime(results.groups, defaultDate, true,padStart,padEnd);
                        // create a zone for each event (padded free time and conflict group)
                        $.each(paddedEvents.allEvents, function (i, event) {
                            var newZone = {
                                index: results.zones.length,
                                isBusy: event.isBusy,
                                group: event,
                                events: event.conflicts,
                                columns: _this.packColumns(event.isBusy?event.conflicts:null),
                            };
                            // For each column, go ahead and calculate the free time
                            $.each(newZone.columns, function (i, col) {
                                var freeTime = _this.calcFreeTime(col.events, defaultDate, true, newZone.group.start(), newZone.group.end());
                                $.extend(col, freeTime);
                            });
                            results.zones.push(newZone);
                        });
                    }

                    // For each zone , go ahead and calculate the free time
                    $.each(results.zones, function (i, zone) {
                        var freeTime = _this.calcFreeTime(zone.events, defaultDate, true, zone.group.start(), zone.group.end());
                        $.extend(zone, freeTime);
                    });

                    return results;
                },

                // General purpose:
                // Calculates Free Time not covered by an event
                // Think of this as "spacers" between each event
                this.calcFreeTime = function (events, defaultDate, padTimes, padStart, padEnd) {
                    var results = {
                        events: events,
                        freeTime: [],
                        allEvents: [],
                    };

                    var pad = (padTimes == null || padTimes);

                    if (events == null || events.length == 0) {
                        if (pad) {
                            // Add a single gap for the entire day
                            var freeTimeItem = {};
                            freeTimeItem[this.options.event.startPropertyName] = padStart != null ? moment(padStart) : moment(defaultDate).hour(0).minute(0).second(0).millisecond(0);
                            freeTimeItem[this.options.event.endPropertyName] = padEnd != null ? moment(padEnd) : moment(defaultDate).hour(0).minute(0).second(0).millisecond(0).add({ days: 1 });
                            var freeTime = new FCEvent(freeTimeItem, this.options.event, false);
                            results.freeTime.push(freeTime);
                            results.allEvents.push(freeTime);
                        }
                        return results;
                    }

                    // sort all items
                    results.events.sort(this.sortByStartDate);

                    // Get the starting date
                    var lastBusyTime = padStart != null ? moment(padStart) : moment(defaultDate).hour(0).minute(0).second(0).millisecond(0);
                    if (results.events[0].start() < lastBusyTime)
                        lastBusyTime = results.events[0].end().min(lastBusyTime);

                    // Get the ending data
                    var lastMoment = results.events[results.events.length - 1].end();
                    var maxBusyTime = padEnd != null ? moment(padEnd) : moment(defaultDate).hour(0).minute(0).second(0).millisecond(0).add({ days: 1 }).subtract("seconds",1);

                    $.each(results.events, function (i, event) {

                        if (event.start().diff(lastBusyTime, "seconds") > 1) {
                            if (pad) {
                                // Add a free time slot
                                var freeTimeItem = {};
                                freeTimeItem[event.options.startPropertyName] = moment(lastBusyTime);
                                freeTimeItem[event.options.endPropertyName] = moment(event.start()).subtract("seconds",1);
                                var freeTime = new FCEvent(freeTimeItem, event.options, false);
                                results.freeTime.push(freeTime);
                                results.allEvents.push(freeTime);
                            }
                            // add the event
                            results.allEvents.push(event);
                            // update the busy time end
                            lastBusyTime = event.end();
                        }
                        else {
                            // add the ebent
                            results.allEvents.push(event);
                            // update the busy time end if necessary
                            lastBusyTime = lastBusyTime.min(event.end());
                        }

                    });

                    // Case where we need to fill to the end of the day
                    if (pad && maxBusyTime.diff(lastBusyTime, "seconds") > 1) {
                        // add the free time
                        var freeTimeItem = {};
                        var tempEvent = results.events[0];
                        freeTimeItem[tempEvent.options.startPropertyName] = moment(lastBusyTime);
                        freeTimeItem[tempEvent.options.endPropertyName] = maxBusyTime;
                        var freeTime = new FCEvent(freeTimeItem, tempEvent.options, false);
                        results.freeTime.push(freeTime);
                        results.allEvents.push(freeTime);
                        lastBusyTime = maxBusyTime;
                    }

                    return results;
                },

                // Scroll the view to the given time (ignoring date)
                this.scrollToTime = function (time) {
                    if (time==null || this.$scroll == null)
                        return;
                    var timeMoment = moment.isMoment(time) ? time : moment(time);
                    this.$scroll.scrollTop(time.hour() * 60 + time.minute());
                }

                // Build the HTML calendar
                this.build = function () {
                    var _this = this;
                    var buildBlackedOut = (this.$blackout != null && this.$blackout.is(":visible")) || this.options.display.defaultWaitOptions.show;
                    this.$container.empty();

                    var startDate = this.options.display.startDate != null ? this.options.display.startDate : moment().startOf("week").add("days", 1);
                    var endDate = this.options.display.endDate != null ? this.options.display.endDate : moment().endOf("week");
                    // bit of a cheat: always make start/end time 1/1/year to avoid DST issues with skipping over the missing time period
                    var baseTime = moment(startDate).month(1).day(1);
                    var startTime = moment(baseTime).hour(this.options.display.startHour).minute(0).second(0).millisecond(0);
                    var endTime = moment(baseTime).hour(this.options.display.endHour).minute(59).second(59).millisecond(59);
                    var minutesDisplayed = endTime.diff(startTime, "minutes") + 1;

                    var numDays = 0;
                    for (var date = moment(startDate) ; date < moment(endDate) ; date = date.add("days", 1)) {
                        if ($.inArray(date.day(), this.options.display.daysOfWeek)>=0)
                            numDays += 1;
                    }
                    var dayWidth = (100.0 - _this.options.display.markerColumnWidth) / (1.0 * numDays);

                    // add all the date headers
                    var titleContainer = this.options.calendarTemplates.titleContainer;
                    this.$container.append($(titleContainer));
                    this.$titleContainer = this.$container.children().last();

                    var blank = $.expandTemplateFromObject(_this.options.calendarTemplates.blankTitle, _this.options.display);
                    this.$titleContainer.append($(blank));
                    this.$blank = this.$titleContainer.children().last();

                    var tools = $.expandTemplateFromObject(_this.options.calendarTemplates.toolArea, _this.options.display);
                    this.$blank.append($(tools));
                    this.$toolArea = this.$blank.children().last();
                    this.onBuildToolArea(this.$toolArea);

                    for (var date = moment(startDate) ; date < moment(endDate) ; date = date.add("days", 1)) {

                        if ($.inArray(date.day(), this.options.display.daysOfWeek) >= 0) {
                            var dateCss = date.format("dddd") + " ";
                            dateCss += moment().year() == date.year() && moment().month() == date.month() && moment().date() == date.date() ? this.options.display.currentDayTitleCss : "";
                            if (this.isEnabled() && this.options.allowHeaderClick)
                                dateCss += " " + this.options.display.defaultWaitOptions.enabledCss;
                            else 
                                dateCss += " " + this.options.display.defaultWaitOptions.disabledCss;

                            dayTitleContainer = $.expandTemplateFromObject(_this.options.calendarTemplates.title, {
                                CSS: dateCss,
                                title: date.format(this.options.formatting.titleDateFormat),
                                dataAttribName: this.options.dataAttribName,
                                value: date.format(this.options.formatting.attribDateFormat),
                                titleStyle: "width:" + dayWidth + "%;",
                            });
                            this.$titleContainer.append($(dayTitleContainer));
                            var $dayTitle = this.$titleContainer.children().last();
                            $dayTitle.on("click", function (e) { _this.onHeaderClicked(e, $(this)); });
                        }
                    }

                    // add the scrollable area
                    var scrollContainer = _this.options.calendarTemplates.scroll; 
                    this.$container.append($(scrollContainer));
                    this.$scroll = this.$container.children().last();


                    // Add the underlay
                    var underlayContainer = _this.options.calendarTemplates.underlay;
                    this.$scroll.append($(underlayContainer));
                    this.$underlay = this.$scroll.children().last();

                    for (var time = moment(startTime) ; time <= moment(endTime) ; time = time.add("minutes", this.options.display.hourTickMarksInMinutes)) {
                        var rowClasses = "";
                        var isNow = moment().hour() == time.hour();
                        if (this.options.display.hilightCurrentHour && isNow)
                            rowClasses = this.options.display.currentHourCss;

                        var underrow = $.expandTemplateFromObject(_this.options.calendarTemplates.underlayRow, {
                            CSS: rowClasses,
                            dataAttribName: this.options.dataAttribName,
                            value: time.format(this.options.formatting.attribTimeFormat),
                        });
                        this.$underlay.append($(underrow));
                        lastTime = time;
                    }

                    var overlayContainer = _this.options.calendarTemplates.overlay;
                    this.$scroll.append($(overlayContainer));
                    this.$overlay = this.$scroll.children().last();

                    // Add the time scale
                    var markerContainer = $.expandTemplateFromObject(_this.options.calendarTemplates.markerContainer, _this.options.display);
                    this.$overlay.append($(markerContainer));
                    var $markers = this.$overlay.children().last();

                    for (var time = moment(startTime) ; time <= moment(endTime) ; time = time.add("hours", 1)) {
                        var classes = "";
                        var isNow = moment().hour() == time.hour();
                        if (this.options.display.hilightCurrentHour && isNow)
                            classes = this.options.display.currentHourCss;
                        var marker = $.expandTemplateFromObject(_this.options.calendarTemplates.marker, {
                            CSS: classes,
                            title: time.format(this.options.formatting.markerTimeFormat),
                            dataAttribName: this.options.dataAttribName,
                            value: time.format(this.options.formatting.attribTimeFormat),
                        });
                        $markers.append($(marker));
                    }

                    // Add the day container
                    var daysContainer = _this.options.calendarTemplates.daysContainer;
                    this.$overlay.append($(daysContainer));
                    this.$daysContainer = this.$overlay.children().last();

                    for (var date = moment(startDate) ; date < moment(endDate) ; date = date.add("days", 1)) {
                        if ($.inArray(date.day(), this.options.display.daysOfWeek)>=0) {
                            var dayContainer = $.expandTemplateFromObject(this.options.calendarTemplates.day, {
                                dataAttribName: this.options.dataAttribName,
                                value: date.format(this.options.formatting.attribDateFormat),
                                width: dayWidth,
                                CSS: date.format("dddd"),
                            });
                            this.$daysContainer.append($(dayContainer));
                            var $dayContainer = this.$daysContainer.children().last();
                            this.refreshDay(date, $dayContainer, false);
                        }
                    }

                    var footerContainer = this.options.calendarTemplates.footerContainer;
                    this.$container.append($(footerContainer));
                    this.$footerContainer = this.$container.children().last();


                    // If we want to scroll to a specific time, do that now
                    if (this.options.display.scrollToHour != 0) {
                        var timeToScroll = moment().hour(this.options.display.scrollToHour < 0 ? moment().hour() : this.options.display.scrollToHour).minute(0).second(0).millisecond(0);
                        this.scrollToTime(timeToScroll);
                    }

                    // Create a blackout container for loading/unloading/enable/disable
                    var blackoutContainer = _this.options.calendarTemplates.blackout;
                    this.$scroll.append($(blackoutContainer));
                    this.$blackout = this.$scroll.children().last();
                    var blackoutHeight = minutesDisplayed;
                    this.$blackout.height(blackoutHeight);

                    if (buildBlackedOut)
                        this.showWait(null,false);

                    // Finally animate the show of each event
                    this.makeEventsVisible($container.find(".event"));
                }

                this.onBuildToolArea = function ($toolArea) {
                    var _this = this;
                    var res = { cancel: false };
                    if ($.isFunction(this.options.callbacks.onBuildToolArea))
                        res = $.extend(res, this.options.callbacks.onBuildToolArea(this, $toolArea));
                    if (res.cancel || !this.options.display.allowDefaultTools)
                        return;

                    var next = $.expandTemplateFromObject(_this.options.calendarTemplates.nextButton, _this.options.display);
                    $toolArea.append($(next));
                    this.$toolNext = $toolArea.children().last();
                    this.$toolNext.on("click", function (e) {
                        if(_this.isEnabled())
                            _this.next();
                    });

                    var prev = $.expandTemplateFromObject(_this.options.calendarTemplates.prevButton, _this.options.display);
                    $toolArea.append($(prev));
                    this.$toolPrev = $toolArea.children().last();
                    this.$toolPrev.on("click", function (e) {
                        if (_this.isEnabled())
                            _this.previous();
                    });

                    return res;
                }

                this.makeEventsVisible = function ($events) {
                    if ($events == null)
                        return;
                    if (this.options.display.shouldAnimateOnShow)
                        $events.slideDown();
                    else
                        $events.show();
                }

                this.getDayContainer = function (date) {
                    var fields = { dataAttribName: this.options.dataAttribName, value: date.format(this.options.formatting.attribDateFormat) };
                    return this.$daysContainer.find($.stringFormat(".day[{0}='{1}']", this.options.dataAttribName, date.format(this.options.formatting.attribDateFormat)));
                }

                // Refreshes the display of events for a given date
                this.refreshDay = function (date, $containerOfTheDay, makeVisible) {
                    var _this = this;

                    var baseTime = moment(date).hour(0).minute(0).second(0).millisecond(0);
                    var startTime = moment(baseTime).hour(this.options.display.startHour).minute(0).second(0).millisecond(0);
                    var endTime = moment(baseTime).hour(this.options.display.endHour).minute(59).second(59).millisecond(59);
                    var minutesDisplayed = endTime.diff(startTime, "minutes") + 1;
                    var minutesOffset = startTime.diff(baseTime, "minutes");

                    var $dayContainer = $containerOfTheDay != null ? $containerOfTheDay : this.getDayContainer(date);
                    if ($dayContainer == null || $dayContainer.length == 0)
                        return;

                    // Clear out anything inside the day
                    $dayContainer.empty();

                    var dateEnd = moment(date).endOf("day");

                    // Filter by just those items we are interested in displaying on this date
                    var res = this.filterItems(this.options.items, startTime, endTime);
                    // Calculate the optimal layout for events, taking into account conflicts
                    var layout = this.calcZoneLayout(res.events, date, startTime, endTime);
                    // keep track of how many minutes are remaining so we can crop events that 
                    // span multiple days
                    var totalMinutesUsed = 0;
                    var maxMinutesShown = 1439;

                    $.each(layout.zones, function (z, zone) {

                        var numCols = zone.columns.length;
                        // Make sure we round down slightly otherwise accumulated error could put us over the 100.0 cap
                        // and cause undo scrolling. In this case...
                        // Either it is 100% or we use a uniform width rounded down to the nearest 100th (2nd decimal place)
                        var colWidthPercent = numCols == 0 ? 100 : Math.floor((100 / numCols) * 100) / 100.0;

                        var eventTemplate = numCols == 1 ? _this.options.eventTemplates.oneColumn : numCols == 2 ? _this.options.eventTemplates.twoColumn : _this.options.eventTemplates.threeColumn;
                        var colClass = numCols == 1 ? "one" : numCols == 2 ? "two" : "three";

                        $.each(zone.columns, function (i, col) {

                            var colContainer = $.expandTemplateFromObject(_this.options.calendarTemplates.column, { CSS: colClass, width: $.number(colWidthPercent, 2) });
                            $dayContainer.append($(colContainer));
                            var $colContainer = $dayContainer.children().last();

                            $.each(col.allEvents, function (i, event) {
                                var item = event.item;
                                var duration = event.duration();
                                if (event.isMultiDay() && event.start() < date && event.duration() > maxMinutesShown)
                                    duration = event.end().diff(date, "minutes");
                                duration = Math.min(duration, maxMinutesShown);

                                var height = Math.min(duration, maxMinutesShown - totalMinutesUsed); // cap events that run off the current display
                                var offsetTop = minutesOffset;
                                var eventStyle = "";
                                if (!event.isBusy) {
                                    var gap = $.expandTemplateFromObject(_this.options.calendarTemplates.freeTime, $.extend({}, item, { height: height, eventStyle: eventStyle }));
                                    $colContainer.append(gap);
                                    var $gap = $colContainer.children().last();
                                    $gap.on("click", function (e) { _this.onFreeTimeClicked(e, $gap, event); });
                                }
                                else {
                                    var css = _this.options.display.eventBaseCss + "";
                                    if (event.isMultiDay())
                                        css += (" " + _this.options.display.multiDayCss);
                                    if (_this.options.enabled)
                                        css += (" " + _this.options.display.defaultWaitOptions.enabledCss);
                                    else
                                        css += (" " + _this.options.display.defaultWaitOptions.disabledCss);

                                    eventStyle += "display:none;";
                                    if (event.start() < date) {
                                        css += (" " + _this.options.display.multiDayEnterCss);
                                        if (event.duration() < maxMinutesShown) 
                                            offsetTop += date.diff(event.start(), "minutes")
                                        if (offsetTop != 0)
                                            eventStyle += $.stringFormat("margin-top:-{0}px;", offsetTop);
                                    }
                                    if (event.end() > dateEnd) {
                                        css += (" " + _this.options.display.multiDayLeaveCss);
                                    }
                                    var fields = {
                                        Title: "Event",
                                        Footer: null,
                                        CSS: css,
                                        StartTime: item.AppointmentTime.format(_this.options.formatting.eventTimeFormat) + $.stringFormat("<span class='sup'>{0}</span>", item.AppointmentTime.format("a")),
                                        StartTimeShort: item.AppointmentTime.format(_this.options.formatting.eventTimeFormat),
                                        height: height,
                                        innerHeight: height - 4,
                                        eventStyle: eventStyle,
                                    };
                                    var eventExpanded = $.expandTemplateFromObject(eventTemplate, $.extend({}, item, fields));
                                    $colContainer.append(eventExpanded);
                                    var $event = $colContainer.children().last();
                                    $event.data(_this.options.eventDataKey, event);
                                    $event.on("click", function (e) { _this.onEventClicked(e, $event, event); });
                                    $event.on("hover", function (e) { _this.onEventHoverIn(e, $event, event); }, function (e) { _this.onEventHoverOut(e, $event, event); });
                                    if ($.isFunction(_this.options.callbacks.onEventCreated))
                                        _this.options.callbacks.onEventCreated(_this, $event, event);
                                }
                            });
                        });

                        var zoneMinutesUsed = zone.group.duration();
                        if (zone.group.isMultiDay()) {
                            var clippedStart = zone.group.start().min(date);
                            var clippedEnd = zone.group.end().max(dateEnd);
                            zoneMinutesUsed = clippedEnd.diff(clippedStart, "minutes");
                        }
                        totalMinutesUsed += zoneMinutesUsed;
                    });
                    
                    if(makeVisible==null || makeVisible)
                        this.makeEventsVisible($dayContainer.find(".event"));
                }

                this.update = function (updateOptions) {
                    this.build();
                }

                this.onHeaderClicked = function (e, $header) {

                    var date = moment($header.attr(this.options.dataAttribName));
                    if (!this.isEnabled() || !this.options.allowHeaderClick || ! date.isValid())
                        return { cancel: true };

                    var res = { cancel: false };
                    if ($.isFunction(this.options.callbacks.onHeaderClicked))
                        res = $.extend(res, this.options.callbacks.onHeaderClicked(this, e, $header, date));
                    return res;
                }

                this.onFreeTimeClicked = function (e, $event, event) {
                    if (!this.isEnabled() || !this.options.allowFreeTimeClick)
                        return { cancel: true };

                    var offset = $event.offset();
                    var minuteOffset = e.clientY - offset.top;
                    var timeOfClick = moment(event.start()).add("minutes", minuteOffset);

                    var res = { cancel: false };
                    if ($.isFunction(this.options.callbacks.onFreeTimeClicked))
                        res = $.extend(res, this.options.callbacks.onFreeTimeClicked(this, e, $event, event, timeOfClick));
                    return res;
                }

                this.onEventClicked = function (e, $event, event) {
                    return this.standardEventHandler(e, $event, event, this.options.callbacks.onEventClicked);
                }
                this.onEventHoverIn = function (e, $event, event) {
                    return this.standardEventHandler(e, $event, event, this.options.callbacks.onEventHoverIn);
                }
                this.onEventHoverOut = function (e, $event, event) {
                    return this.standardEventHandler(e, $event, event, this.options.callbacks.onEventHoverOut);
                }

                this.standardEventHandler = function (e, $event, event, callback) {
                    if (!this.isEnabled())
                        return { cancel: true };

                    var res = { cancel: false };
                    if ($.isFunction(callback))
                        res = $.extend(res, callback(this, e, $event, event));
                    return res;
                }

                // get a selector for all the events displayed
                this.getSelectorForAllEvents = function() {
                    return this.$container.find("." + this.options.display.eventBaseCss);
                }

                // get a selector for the given event object
                this.getSelectorForEvent = function(event) {
                    var _this = this;
                    var $events = this.getSelectorForAllEvents();
                    var match = null;
                    $.each($events,function(i,$event) {
                        if($event.data(_this.options.eventDataKey) == event) {
                            match = $event;
                            return false;
                        }
                    });
                    return match;
                }

                // delete an event
                this.delete = function (event, refreshDisplay) {
                    if (event == null || event.item == null || this.options.items==null)
                        return;

                    // find and remove the associated item
                    var pos = this.options.items.indexOf(event.item);
                    if (pos >= 0)
                        this.options.items.splice(pos, 1);

                    // refresh any day involved with this event
                    for (var date = moment(event.start()).startOf("day") ; date < moment(event.end()).endOf("day") ; date = date.add("days", 1)) {
                        this.refreshDay(date);
                    }

                }

                // next date is clicked
                this.next = function () {
                    return this.moveRelative(this.options.display.defaultMoveTimepart, this.options.display.defaultMoveAmount, this.options.callbacks.onCalendarNext);
                }
                // previous date is clicked
                this.previous = function () {
                    return this.moveRelative(this.options.display.defaultMoveTimepart, -1 * this.options.display.defaultMoveAmount, this.options.callbacks.onCalendarPrevious);
                }

                // Move forward (positive) or backward (negative) a relative amount
                // timepart = 'days','months','years',etc...
                // amount = #days, #months, etc.
                this.moveRelative = function (timepart, amount, callback) {
                    if (typeof (timepart) != "string")
                        return false;
                    if (amount == null)
                        amount = 1;

                    var diff = moment(this.options.display.endDate).add("seconds", 1).diff(this.options.display.startDate, "days");
                    var current = { startDate: moment(this.options.display.startDate), endDate: moment(this.options.display.endDate) };
                    var newStart = moment(this.options.display.startDate).add(timepart, amount);
                    var next = { cancel: false, startDate: newStart, endDate: moment(newStart).add("days", diff) };

                    var res = next;
                    if ($.isFunction(callback))
                        res = $.extend({}, next, callback(this, current, res));
                    if (res.cancel)
                        return false;

                    if ($.isFunction(this.options.callbacks.onMoveRelative))
                        res = $.extend({}, next, this.options.callbacks.onMoveRelative(this, current, res));
                    if (res.cancel)
                        return false;

                    this.options.display.startDate = moment(res.startDate);
                    this.options.display.endDate = moment(res.endDate);

                    if (res.showWait) {
                        var anim = this.showWait($.extend(res, { show: true }));
                        if (anim != null) {
                            anim.promise().done(function () {
                                if ($.isFunction(res.waitCallback))
                                    res.waitCallback();
                            });
                        }
                        else if ($.isFunction(res.waitCallback))
                            res.waitCallback();
                    }
                    else
                        this.update();
                }

                // Shows / Hides the waiting blackout and indicators
                this.showWait = function (waitOptions, animate) {
                    if (this.lastWaitOptions == null)
                        this.lastWaitOptions = this.options.display.defaultWaitOptions;
                    var shouldAnimate = animate == null || animate;

                    $.extend(this.lastWaitOptions, waitOptions);

                    this.tempDisable = this.lastWaitOptions.disable;
                    var isAlreadyBlackedOut = this.$blackout != null && this.$blackout.is(":visible");

                    if (this.lastWaitOptions.show) {
                        this.$container.addClass(this.lastWaitOptions.disabledCss);
                        this.$titleContainer.children().removeClass(this.lastWaitOptions.enabledCss).addClass(this.lastWaitOptions.disabledCss);
                        if (!isAlreadyBlackedOut) {
                            if (shouldAnimate)
                                return this.$blackout.fadeIn();
                            else
                                return this.$blackout.show();
                        }
                    }
                    else {
                        this.$container.removeClass(this.lastWaitOptions.disabledCss);
                        if (this.isEnabled() && this.options.allowHeaderClick)
                            this.$titleContainer.children().removeClass(this.lastWaitOptions.disabledCss).addClass(this.lastWaitOptions.enabledCss);

                        if (isAlreadyBlackedOut) {
                            if (shouldAnimate)
                                return this.$blackout.fadeOut();
                            else
                                return this.$blackout.hide();
                        }
                    }
                    return null;
                }

            }

            if (typeof (options) == 'string') {                
                var selector = $(this[0]);
                var controller = selector.data("forgeCalendar");
                return controller.onAction.apply(controller, arguments);
            }
            else { // init with options

                //Defaults options are set
                var defaults = {
                    items: null, // your own objects go here
                    enabled: true, // Disable/Enable user interaction
                    allowFreeTimeClick: true, // whether or not an event is generated when the free time area is clicked
                    allowHeaderClick: true, // whether or not an event is generated when the a header area clicked
                    defaultAction: "update",
                    dataAttribName: "data-value",
                    eventDataKey: "event",
                    callbacks: {
                        // Most all callbacks can return { cancel: true } to prevent default behavior
                        onEventClicked: null, //function (plugin, e, $event, event)
                        onEventHoverIn: null, //function (plugin, e, $event, event)
                        onEventHoverOut: null, //function (pluginm e, $event, event)
                        onFreeTimeClicked: null, //function (plugin, e, $event, event, timeOfClick)
                        onHeaderClicked: null, //function (plugin, e, $header, date)
                        onEventCreated: null, // function (plugin, $event, event)
                        onBuildToolArea: null, // function (plugin, $toolArea)
                        onCalendarNext: null, // function (plugin, {startDate,endDate}, {newStartDate, newEndDate} )  returns {newStartDate,newEndDate,cancel}
                        onCalendarPrev: null, // function (plugin, {startDate,endDate}, {newStartDate, newEndDate} )  returns {newStartDate,newEndDate,cancel}
                        onMoveRelative: null, // function (plugin, {startDate,endDate}, {newStartDate, newEndDate} )  returns {newStartDate,newEndDate,cancel}
                    },
                    // Item Properties that determine when an event occurs and its duration
                    event: {
                        startPropertyName: "AppointmentTime",
                        endPropertyName: "EndTime",
                        durationPropertyName: "Duration",
                    },
                    // Time Formats
                    formatting: {
                        startTimeFormat: "h:mm",
                        titleDateFormat: "ddd, MMM D",
                        markerTimeFormat: "LT",
                        eventTimeFormat: "h:mm",
                        attribDateFormat: "ddd, ll",
                        attribTimeFormat: "HHmm",
                    },
                    // Display and Behavior
                    display: {
                        startDate: null,
                        endDate: null,
                        daysOfWeek: [0,1,2,3,4,5,6], // list days of week to show for the time period, 0=SUN, 1=MON,....6=SAT
                        startHour: 0,
                        endHour: 23,
                        scrollToHour: -1, // -1 means current time, 0 means no scroll
                        hilightCurrentHour: true,
                        hilightDSTChange: true,
                        currentDayTitleCss: "now",
                        currentHourCss: "now",
                        dstChangeCss: "dst",
                        multiDayCss: "multi", // event spans more than 1 calendar day
                        multiDayLeaveCss: "out", // event spans to the next day
                        multiDayEnterCss: "in", // event is coming over from previous day
                        eventBaseCss: "event",
                        hourTickMarksInMinutes: 30, // must be a perfect divisor of 60
                        shouldAnimateOnShow: true,
                        allowMultiDay: true, // true to display events that span multiple days, otherwise show them only on their start date
                        markerColumnWidth: 6.0, // percentage
                        allowDefaultTools: true,
                        defaultMoveTimepart: "week",
                        defaultMoveAmount: 1,
                        defaultWaitOptions: {
                            show: true,
                            disable: true,
                            disabledCss: "disabled",
                            enabledCss: "enabled"
                    },
                    },
                    // Templates
                    eventTemplates: {
                        oneColumn:
                            "<div class='{CSS}' style='height:{height}px;{eventStyle}'>" +
                                "<div class='inner' style='height:{innerHeight}px;'>" +
                                    "<div class='header'><span class='left'>{Title}</span></div>" +
                                    "<div class='content'>{StartTime}</div>" +
                                    "<div class='footer'>{Footer}</div>" +
                                "</div>" +
                            "</div>",
                        twoColumn:
                            "<div class='{CSS}' style='height:{height}px;{eventStyle}'>" +
                                "<div class='inner' style='height:{innerHeight}px;'>" +
                                    "<div class='header'><span class='left'>{Title}</span></div>" +
                                    "<div class='content'>{StartTime}</div>" +
                                     "<div class='footer'>{Footer}</div>" +
                               "</div>" +
                            "</div>",
                        threeColumn:
                            "<div class='{CSS}' style='height:{height}px;{eventStyle}'>" +
                                "<div class='inner' style='height:{innerHeight}px;'>" +
                                    "<div class='header'><span class='left'>{Title}</span></div>" +
                                    "<div class='content'>{StartTime}</div>" +
                                    "<div class='footer'>{Footer}</div>" +
                                "</div>" +
                            "</div>",
                    },
                    calendarTemplates: {
                        titleContainer: "<div class='day titleContainer'></div>",
                        footerContainer: "<div class='day footer'></div>",
                        blankTitle: "<div class='day title blank' style='width:{markerColumnWidth}%;'></div>",
                        title: "<div class='day title {CSS}' style='{titleStyle}' {dataAttribName}='{value}'>{title}</div>",
                        scroll: "<div class='scroll'></div>",
                        underlay: "<div class='underlay'></div>",
                        underlayRow: "<div class='row {CSS}' {dataAttribName}='{value}'></div>",
                        overlay: "<div class='overlay'></div>",
                        blackout: "<div class='blackout' style='display:none;'></div>",
                        markerContainer: "<div class='marker column' style='width:{markerColumnWidth}%;'></div>",
                        marker: "<div class='marker {CSS}' {dataAttribName}='{value}'>{title}</div>",
                        daysContainer: "<div class='days'></div>",
                        day: "<div class='day {CSS}' style='width:{width}%;' {dataAttribName}='{value}'></div>",
                        freeTime: "<div class='gap' style='height:{height}px;{eventStyle}'></div>",
                        column: "<div class='column {CSS}' style='width:{width}%'></div>",
                        toolArea: "<div class='tools'></div>",
                        nextButton: "<div class='nextPage'></div>",
                        prevButton: "<div class='prevPage'></div>",
                    },
                };

                return this.each(function () {
                    var containerId = $(this).attr("id");
                    var controller = $(this).data("forgeCalendar");
                    // Create a new controller for this plugin if necessary
                    if (controller == null) {
                        controller = new forgeCalendarController(containerId, $.extend(true, defaults, options));
                        // Save the controller into this element for future retrieval
                        $(this).data("forgeCalendar", controller);
                        // Mark this element as being a calendar
                        $(this).attr("data-control", "forgeCalendar");
                    }
                    else
                        controller.options = $.extend(true, {}, controller.options, options);
                    // build the scaffolding HTML and initialize
                    controller.update.apply(controller);
                });

            }
        }
    });
})(jQuery);