/**
 *
 * Servant SDK Javascript for Client-Side Applications and Regular Web Pages
 * Version: v1.1.3
 * By Servant – https://www.servant.co
 * Copyright 2014 Servant
 * Authors: Austen Collins
 * Contact: austen@servant.co
 *
 * Documentation Available @ https://developers.servant.co
 *
 */





(function(root) {

    // Establish root object, 'window' in the browser
    root.Servant = root.Servant || {};
    var Servant = root.Servant;
    Servant.status = "uninitialized";



    /**
     *
     *  Initialization ------------------------------------------------------------------------------------
     *
     *  Options:
     *
     *  application_client_id       // CLIENT_ID of application registered on Servant
     *  version                     // Api version integer.  0 is only option currently
     *  protocol                    // 'http' or 'https'.  Defaults to 'http'
     *  scope                       // 'full' to use read/write accesstoken or 'limited' to use read only accesstoken.  Defaults to 'full'
     *  token                       // AccessToken
     *  cache                       // Auto-Cache Servants and User data in SDK when fetched.   Defaults to true.
     *  upload_file_input_class     // Class of file input field for onchange listener used to upload files
     *  upload_dropzone_class       // Class of dropzone elements for drop listener
     *  upload_image_preview_id     // ID of image preview container to which img elements will be appended
     *  upload_success_callback     // Upload success callback
     *  upload_failed_callback      // Ppload failed callback
     *  upload_started_callback     // Fired when uploading has begun
     *  upload_finished_callback    // Fired when uploading has finished
     *  upload_progress_callback    // Upload progress callback.  Returns percentage, bytes loaded, bytes total as params
     *  upload_queue_callback       // Fired whenever an image in the queue has started to be uploaded
     *
     */


    Servant.initialize = function(options, callback) {

        var self = this;

        /**
         * Check For Missing Options
         */
        if (!options) return console.error('Servant SDK Error – Please include the required options');
        if (!options.application_client_id) return console.error('Servant SDK Error – Please Include Your Application Client ID when initializing the SDK');

        /**
         * Expose Variables
         */
        this.user = null;
        this.servants = null;
        this.servant = null;
        this.uploadable_archetype_record_id = null;

        /**
         * Set Options and Defaults
         */
        this._archetypes = {}; // JSON Archetypes the user is working with
        this._application_client_id = options.application_client_id; // Application Client ID
        this._version = typeof options !== 'undefined' && typeof options.version !== 'undefined' ? options.version : 0; // API Version
        this._protocol = typeof options !== 'undefined' && typeof options.protocol !== 'undefined' ? options.protocol : 'http'; // HTTP Protocol
        this._scope = typeof options !== 'undefined' && typeof options.scope !== 'undefined' ? options.scope : 'full'; // AccessToken Scope:  Is it a FULL or LIMITED token?
        this._cache = typeof options !== 'undefined' && typeof options.cache !== 'undefined' ? options.cache : true;
        this._connectURL = 'https://www.servant.co/connect/oauth2/authorize?response_type=token&client_id=' + this._application_client_id;

        // Dev Options
        this._dashboard = options.dashboard || null;
        if (options.development) {
            this._path = this._protocol + '://api' + this._version + '.localhost:4000'; // API Path
        } else {
            this._path = this._protocol + '://api' + this._version + '.servant.co'; // API Path
        }

        /**
         * Set Token or Check For It In Window Location
         */
        if (options && options.token) {
            this._token = options.token;
            this.status = "has_token";
        } else if (root.location.hash.length && root.location.hash.indexOf('access_token=') > -1) {
            // Set Token whether it's FULL or LIMITED
            var hashData = JSON.parse('{"' + decodeURI(root.location.hash).replace('#', '').replace(/"/g, '\\"').replace(/&/g, '","').replace(/=/g, '":"') + '"}');
            this._token = this._scope === 'full' ? hashData.access_token : hashData.access_token_limited;
            this.status = "has_token";
            // Remove hash fragment from URL, new and old browsers
            var scrollV, scrollH, loc = window.location;
            if ("pushState" in history) {
                history.pushState("", document.title, loc.pathname + loc.search);
            } else {
                // Prevent scrolling by storing the page's current scroll offset
                scrollV = document.body.scrollTop;
                scrollH = document.body.scrollLeft;
                loc.hash = "";
                // Restore the scroll offset, should be flicker free
                document.body.scrollTop = scrollV;
                document.body.scrollLeft = scrollH;
            }
        } else {
            this.status = "no_token";
        }

        /**
         * Initialize Uploadable Archetypes
         */
        Servant.initializeUploadableArchetypes(options);

        // Render Callback If Included
        if (callback) return callback(this.status);
    };



    /**
     *
     *
     *
     *
     *
     *
     * INTERNAL METHODS ------------------------------------------------------------------------------------
     *
     *
     *
     *
     *
     *
     *
     */

    /**
     * General Function To Call the Servant API
     */
    Servant._callAPI = function(method, path, json, success, failed) {

        if (this.status !== "has_token") return console.error('Servant SDK Error – The SDK has no Access Token');

        var url = this._path + path;
        if (this._protocol === 'https') url = url + '&protocol=https';
        if (this._dashboard) url = url + '&dashboard=true';

        var xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function() {
            if (xhr.readyState < 4)
                return;
            if (xhr.status !== 200)
                return failed.call(window, JSON.parse(xhr.responseText));
            if (xhr.readyState === 4) {
                success.call(null, JSON.parse(xhr.responseText));
            }
        };

        xhr.open(method.toUpperCase(), url, true);
        if (json) {
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.send(JSON.stringify(json));
        } else {
            xhr.send();
        }
    };

    /**
     *  Save Image Archetype
     *  Create or Save an image archetype
     */
    Servant._saveImageArchetype = function(files) {
        var self = this;
        // Check if Servant is set
        if (!self.servant) return console.error('Servant SDK Error – You have to set Servant.servant before you can upload images.  Use Servant.setServant(servant).');
        // Check if browser supports FileAPI
        if (window.FormData === undefined) return console.error('Servant SDK Error – This browser does not support the File API and cannot use this method to upload images');
        // If trying to upload multiple files to an existing record, allow only one
        if (self.uploadable_archetype_record_id && files.length > 1) files = files[0];

        // Upload Image Function
        function imageUpload(image_file, queue_count, callback) {

            // Check Type
            if (['image/jpeg', 'image/jpg', 'image/png', 'image/gif'].indexOf(image_file.type) < 0) {
                return callback(queue_count, {
                    code: 'FileFormatNotAllowed',
                    message: 'Image file type must be a JPEG, PNG or GIF'
                }, null);
            }
            // Check File Size
            if (image_file.size > 8000000) {
                return callback(queue_count, {
                    code: 'FileSizeError',
                    message: 'Image file size must be less than 8 megabytes'
                }, null);
            }

            var xhr = new XMLHttpRequest();
            var formData = new FormData();

            xhr.upload.onprogress = function(e) {
                if (self._upload_progress_callback) self._upload_progress_callback(((e.loaded / e.total) * 100), e.loaded, e.total);
            };

            xhr.onload = function() {
                // Queue Callback
                if (xhr.status == 200) {
                    return callback(queue_count, null, JSON.parse(xhr.responseText));
                } else {
                    return callback(queue_count, JSON.parse(xhr.responseText), null);
                }
            };

            xhr.onerror = function() {
                // Queue Callback
                return callback(queue_count, JSON.parse(xhr.responseText, null));
            };

            // Set URL
            var url = self._path + '/data/servants/' + self.servant._id + '/archetypes/image';
            // Add Existing Record ID, if it is set
            if (self.uploadable_archetype_record_id) url = url + '/' + self.uploadable_archetype_record_id;
            // Add Access Token
            url = url + '?access_token=' + self._token;
            // Add Protocol
            if (self._protocol) url = url + '&protocol=https';
            // Add dashboard param, if it is set
            if (self._dashboard) url = url + '&dashboard=true';

            var method = typeof self.uploadable_archetype_record_id === 'string' ? 'PUT' : 'POST';

            xhr.open(method, url, true);
            formData.append("uploads", image_file);
            xhr.send(formData);
        };

        // Prepare Image Previews
        if (this._upload_image_preview_id) {
            var image_preview_container = document.getElementById(this._upload_image_preview_id);
            // Loop through and create image previews
            for (i = 0; i < files.length; i++) {
                var img = document.createElement("img");
                img.classList.add("image-archetype-preview");
                img.file = files[i];
                image_preview_container.appendChild(img);
                var reader = new FileReader();
                reader.onload = (function(aImg) {
                    return function(e) {
                        aImg.src = e.target.result;
                    };
                })(img);
                reader.readAsDataURL(files[i]);
            }
            var previews = true;

            // Collect Each Image Preview in an array, to remove after upload
            var image_elements = document.querySelectorAll(".image-archetype-preview");
        } else {
            var previews = false;
        }

        var images = files;
        var queue_count = 0;

        function imageQueue() {
            // Check if finished
            if (queue_count < images.length) {
                // Upload
                new imageUpload(images[queue_count], queue_count, function(queue, error, response) {
                    // Remove Preview
                    if (previews) document.getElementById(self._upload_image_preview_id).children[0].remove();
                    // Callback
                    if (error) self._upload_failed_callback(error);
                    self._upload_success_callback(response);
                    // Run Again?
                    if (queue_count < images.length + 1) {
                        imageQueue();
                    }
                });
                // Increment Counter
                queue_count = queue_count + 1;
                // Fire Queue Callback
                self._upload_queue_callback(queue_count, images.length);
            } else {
                // Finished Uploading Queue, Clean Up Everything
                // Ensure Previews Are Removed
                if (previews) document.getElementById(self._upload_image_preview_id).innerHTML = '';
                // Clear File Inputs
                var file_inputs = document.querySelectorAll('.' + self._upload_file_input_class);
                for (i = 0; i < file_inputs.length; i++) {
                    var oldInput = file_inputs[i];
                    var newInput = document.createElement("input");
                    newInput.type = "file";
                    newInput.multiple = true;
                    newInput.className = self._upload_file_input_class;
                    oldInput.parentNode.replaceChild(newInput, oldInput);
                    newInput.addEventListener("change", function() {
                        self._saveImageArchetype(this.files);
                    }, false);
                }
                // Finished Callback
                if (self._upload_finished_callback) self._upload_finished_callback();
            }
        }

        // Start ImageQueue
        imageQueue();
        // Start Callback
        if (self._upload_started_callback) self._upload_started_callback();
    };


    /**
     * Fetches Archetype Scheme From Servant & Caches It In The SDK
     */
    Servant._addArchetypeSchema = function(archetype, callback) {
        var self = this;

        this._callAPI('GET', '/data/archetypes/' + archetype + '?', null, function(response) {
            self._archetypes[archetype] = response;
            callback(response);
        }, function(error) {
            callback(error);
        });
    };

    /**
     * Utility Functions to Help With Validation
     */
    Servant._utilities = {};
    Servant._utilities.whatIs = function(what) {

        var to = typeof what;

        if (to === 'object') {
            if (what === null) {
                return 'null';
            }
            if (Array.isArray(what)) {
                return 'array';
            }
            return 'object'; // typeof what === 'object' && what === Object(what) && !Array.isArray(what);
        }

        if (to === 'number') {
            if (isFinite(what)) {
                if (what % 1 === 0) {
                    return 'integer';
                } else {
                    return 'number';
                }
            }
            if (isNaN(what)) {
                return 'not-a-number';
            }
            return 'unknown-number';
        }

        return to; // undefined, boolean, string, function

    };

    Servant._utilities.areEqual = function(json1, json2) {
        if (json1 === json2) {
            return true;
        }

        var i, len;

        // If both are arrays
        if (Array.isArray(json1) && Array.isArray(json2)) {
            // have the same number of items; and
            if (json1.length !== json2.length) {
                return false;
            }
            // items at the same index are equal according to this definition; or
            len = json1.length;
            for (i = 0; i < len; i++) {
                if (!this._utilities.areEqual.call(this, json1[i], json2[i])) {
                    return false;
                }
            }
            return true;
        }

        // If both are objects
        if (this._utilities.whatIs.call(this, json1) === 'object' && this._utilities.whatIs.call(this, json2) === 'object') {
            // have the same set of property names; and
            var keys1 = Object.keys(json1);
            var keys2 = Object.keys(json2);
            if (!this._utilities.areEqual.call(this, keys1, keys2)) {
                return false;
            }
            // values for a same property name are equal according to this definition.
            len = keys1.length;
            for (i = 0; i < len; i++) {
                if (!this._utilities.areEqual.call(this, json1[keys1[i]], json2[keys1[i]])) {
                    return false;
                }
            }
            return true;
        }

        return false;
    };

    Servant._utilities.isUniqueArray = function(arr, indexes) {
        var i, j, l = arr.length;
        for (i = 0; i < l; i++) {
            for (j = i + 1; j < l; j++) {
                if (this._utilities.areEqual.call(this, arr[i], arr[j])) {
                    if (indexes) {
                        indexes.push(i, j);
                    }
                    return false;
                }
            }
        }
        return true;
    };

    Servant._utilities.formatValidators = {
        "date": function(date) {
            if (typeof date !== "string") {
                return true;
            }
            // full-date from http://tools.ietf.org/html/rfc3339#section-5.6
            var matches = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(date);
            if (matches === null) {
                return false;
            }
            // var year = matches[1];
            // var month = matches[2];
            // var day = matches[3];
            if (matches[2] < "01" || matches[2] > "12" || matches[3] < "01" || matches[3] > "31") {
                return false;
            }
            return true;
        },
        "date-time": function(dateTime) {
            if (typeof dateTime !== "string") {
                return true;
            }
            // date-time from http://tools.ietf.org/html/rfc3339#section-5.6
            var s = dateTime.toLowerCase().split("t");
            if (!this._utilities.formatValidators.date(s[0])) {
                return false;
            }
            var matches = /^([0-9]{2}):([0-9]{2}):([0-9]{2})(.[0-9]+)?(z|([+-][0-9]{2}:[0-9]{2}))$/.exec(s[1]);
            if (matches === null) {
                return false;
            }
            // var hour = matches[1];
            // var minute = matches[2];
            // var second = matches[3];
            // var fraction = matches[4];
            // var timezone = matches[5];
            if (matches[1] > "23" || matches[2] > "59" || matches[3] > "59") {
                return false;
            }
            return true;
        },
        "email": function(email) {
            if (typeof email !== "string") {
                return true;
            }
            // use regex from owasp: https://www.owasp.org/index.php/OWASP_Validation_Regex_Repository
            return /^[a-zA-Z0-9+&*-]+(?:\.[a-zA-Z0-9_+&*-]+)*@(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,7}$/.test(email);
        },
        "regex": function(str) {
            try {
                RegExp(str);
                return true;
            } catch (e) {
                return false;
            }
        },
        "uri": function(uri) {
            // RegExp from http://tools.ietf.org/html/rfc3986#appendix-B
            return typeof uri !== "string" || RegExp("^(([^:/?#]+):)?(//([^/?#]*))?([^?#]*)(\\?([^#]*))?(#(.*))?").test(uri);
        }
    }; // _utilities.formatValidators


    /**
     * Validator
     */

    Servant._validators = {
        maximum: function(rules, value) {
            if (rules.exclusiveMaximum !== true) {
                if (value > rules.maximum) return 'Must be less than ' + rules.maximum;
            } else {
                if (value >= rules.maximum) return 'Must be less than ' + rules.maximum;
            }
        },
        minimum: function(rules, value) {
            if (rules.exclusiveMinimum !== true) {
                if (value < rules.minimum) return 'Must be more than ' + rules.minimum;
            } else {
                if (value <= rules.minimum) return 'Must be more than ' + rules.minimum;
            }
        },
        maxLength: function(rules, value) {
            if (value.length > rules.maxLength) return 'Must be less than ' + rules.maxLength + ' characters';
        },
        minLength: function(rules, value) {
            if (json.length < schema.minLength) return 'Must be at least ' + rules.minLength + ' characters or more';
        },
        pattern: function(rules, value) {
            if (RegExp(rules.pattern).test(value) === false) {
                // TODO - Add Error
            }
        },
        maxItems: function(rules, array) {
            if (!Array.isArray(array))
                return;
            if (array.length > rules.maxItems) return 'Only ' + rules.maxItems + ' or less allowed';
        },
        minItems: function(rules, array) {
            if (!Array.isArray(array)) return;
            if (array.length < rules.minItems) return rules.minItems + ' or more are required';
        },
        uniqueItems: function(rules, array) {
            if (!Array.isArray(array))
                return;
            if (rules.uniqueItems === true) {
                if (this._utilities.isUniqueArray.call(this, array, []) === false) return 'No duplicates allowed';
            }
        },
        enum: function(rules, value) {
            var match = false,
                idx = rules.enum.length;
            while (idx--) {
                if (this._utilities.areEqual.call(this, value, rules.enum[idx])) {
                    match = true;
                    break;
                }
            }
            if (match === false) return value + ' is not an allowed option';
        },
        format: function(rules, value) {
            if (!this._utilities.formatValidators[rules.format].call(this, value))
                return 'Not a valid ' + rules.format + ' format';

        },
        required: function(requiredArray, object) {
            var errors = {};
            for (var i = 0, len = requiredArray.length; i < len; i++) {
                if (!object[requiredArray[i]] || object[requiredArray[i]] === '') {
                    errors[requiredArray[i]] = requiredArray[i] + ' is required';
                }
            }
            if (Object.keys(errors).length) return errors;
        }
    };

    Servant._validateProperty = function(errors, rules, value, property) {
        // now iterate all the rules in schema property and execute validation methods
        var keys = Object.keys(rules);
        var idx = keys.length;
        while (idx--) {
            if (this._validators[keys[idx]]) {
                var error = this._validators[keys[idx]].call(this, rules, value, property);
                if (error) return error;
            }
        };
    };

    Servant._validateNestedArchetype = function(errors, rules, value) {
        if (this._utilities.whatIs(value) === 'object') {
            if (!value._id || typeof value._id === 'undefined') return 'Nested Archetypes must be published on Servant first.  Please publish this nested Archetype on Servant, then include the publshed object';
        } else if (this._utilities.whatIs(value) !== 'string') {
            return 'Nested Archetypes must either be an ID string or an object that has already been published on Servant and has an "_id" property.';
        }
        return null;
    };

    Servant._validateArray = function(errors, rules, array, property) {
        // Function to create array errors
        var createArrayError = function(errors, arrayproperty, objectproperty, index, err) {
            if (!errors[arrayproperty]) errors[arrayproperty] = {};
            if (!objectproperty) return errors[arrayproperty][index] = err;
            if (!errors[arrayproperty][index]) errors[arrayproperty][index] = {};
            return errors[arrayproperty][index][objectproperty] = err;
        };
        var self = this;
        // Validate Array Root Schema
        var keys = Object.keys(rules);
        var idx = keys.length;
        while (idx--) {
            if (self._validators[keys[idx]]) {
                var error = self._validators[keys[idx]].call(self, rules, array);
                if (error) errors[property] = error;
            }
        };

        // Iterate Through Array
        array.forEach(function(item, i) {
            if (rules.items.$ref) {
                // Check if nested Archetype
                var error = self._validateNestedArchetype(errors, rules.items, item);
                if (error) createArrayError(errors, property, null, i, error);
            } else if (rules.items.type && rules.items.type !== 'object') {
                // 
                if (self._utilities.whatIs.call(self, item) !== rules.items.type) {
                    createArrayError(errors, property, null, i, 'Invalid type');
                } else {
                    var error = self._validateProperty(errors, rules.items, item, property);
                    if (error) createArrayError(errors, property, null, i, error);
                }
            } else if (rules.items.type && rules.items.type === 'object') {
                // If the item is not an object
                // Check its type
                if (self._utilities.whatIs.call(self, item) !== 'object') {
                    createArrayError(errors, property, null, i, 'Invalid type.  Must be an object');
                } else {
                    // Check Required Fields, If Required Fields Are Specified
                    if (rules.items.required) {
                        var error = self._validators.required(rules.items.required, item);
                    } else {
                        var error = null;
                    }
                    if (error) {
                        for (prop in error) {
                            createArrayError(errors, property, prop, i, error[prop]);
                        }
                    } else {
                        // If Required Fields Are Present, Iterate Through Properties
                        var keys2 = Object.keys(item);
                        var idx2 = keys2.length;
                        while (idx2--) {
                            // Check if property is allowed
                            if (!rules.items.properties[keys2[idx2]]) {
                                createArrayError(errors, property, keys2[idx2], i, 'This property is not allowed');
                            } else {
                                // Validate Properties
                                var keys3 = Object.keys(rules.items.properties[keys2[idx2]]);
                                var idx3 = keys3.length;
                                // Check Type
                                if (rules.items.properties[keys2[idx2]].type && self._utilities.whatIs.call(self, item[keys2[idx2]]) !== rules.items.properties[keys2[idx2]].type) {
                                    createArrayError(errors, property, keys2[idx2], i, 'Invalid Type');
                                } else {
                                    // Other Validations
                                    while (idx3--) {
                                        if (self._validators[keys3[idx3]]) {
                                            var error = self._validators[keys3[idx3]].call(self, rules.items.properties[keys2[idx2]], item[keys2[idx2]]);
                                            if (error && (!errors[property] || !errors[property][i] || !errors[property][i][keys2[idx2]])) createArrayError(errors, property, keys2[idx2], i, error);
                                        }
                                    };
                                }
                            }
                        };
                    }
                }
            }
        });
    };



    /**
     *
     *
     *
     *
     *
     *
     * PUBLIC METHODS ------------------------------------------------------------------------------------
     *
     *
     *
     *
     *
     *
     *
     */


    /**
     *  Set Servant
     *
     *  Takes a String of a servant's ID or an Object containing a servant
     *
     */
    Servant.setServant = function(servant) {
        if (typeof servant !== 'string' && typeof servant !== 'object') return console.error('Servant SDK Error – Invalid parameter - servant must be a String of a servant ID or an Object of a servant');
        if (typeof servant === 'object' && !servant._id) return console.error('Servant SDK Error – The servant you are trying to set does not have an _id property');
        if (typeof servant === 'string') servant = {
            _id: servant
        };
        this.servant = servant;
    };

    /**
     *  Set Servants
     */
    Servant.setServants = function(servants) {
        if (servants.constructor !== Array) return console.error('Servant SDK Error – Invalid parameter - servants must be an Array');
        this.servants = servants;
    };

    /**
     *  Set User
     *
     *  Takes a String of a user's ID or an Object containing a user
     *
     */
    Servant.setUser = function(user) {
        if (typeof user !== 'string' && typeof user !== 'object') return console.error('Servant SDK Error – Invalid parameter - user must be a String of a user ID or an Object of a user');
        if (typeof user === 'object' && !user._id) return console.error('Servant SDK Error – The user you are trying to set does not have an _id property');
        if (typeof user === 'string') user = {
            _id: user
        };
        this.user = user;
    };

    /**
     * Go to Connect URL
     */
    Servant.connect = function() {
        window.location = this._connectURL;
    };

    /**
     * Instantiate An Archeytpe w/ Default Values
     */
    Servant.instantiate = function(archetype, callback) {
        if (typeof archetype !== 'string') return console.error('Servant SDK Error – The new() method only accepts a string for archetype parameter');
        archetype = archetype.toLowerCase();
        if (archetype === 'image') return console.error('Servant SDK Error – Image Archetype cannot be instantiated.  To create an Image Archetype, simply upload an image to Servant.');

        // Check if Archetype has been registered.
        // If not, fetch it from Servant's API then call this function again
        if (!this._archetypes[archetype]) {
            var self = this;
            return this._addArchetypeSchema(archetype, function() {
                return self.instantiate(archetype, callback);
            });
        }

        var instance = {};
        for (property in this._archetypes[archetype].properties) {

            // Handle Depending On Type & Format
            if (this._archetypes[archetype].properties[property].type !== 'array' && this._archetypes[archetype].properties[property].type !== 'object') {

                // Check Format
                if (!this._archetypes[archetype].properties[property].format) {
                    instance[property] = this._archetypes[archetype].properties[property].default;
                } else if (this._archetypes[archetype].properties[property].format === 'date' || this._archetypes[archetype].properties[property].format === 'date-time') {
                    // If Date or Date-time Format
                    var d = new Date();
                    instance[property] = d.toISOString();
                }

            } else {
                // Handle Arrays & Objects
                instance[property] = this._archetypes[archetype].properties[property].default.slice();
            }
        }

        // Remove _id attribute since it is new
        delete instance._id;

        // Callback
        callback(instance);
    };

    /**
     * Public Method – Validate An Archetype Instance
     */
    Servant.validate = function(archetype, instance, success, failed) {

        // Prepare Archetype
        if (typeof archetype !== 'string') {
            throw new Error('Archetype parameter must be a string');
        } else if (!this._archetypes[archetype]) {
            // If Archetype has not been registered, fetch it from Servant's API then call this function again
            var self = this;
            return this._addArchetypeSchema(archetype, function() {
                return self.validate(archetype, instance, success, failed);
            });
        } else {
            archetype = this._archetypes[archetype];
        }

        var errors = {};

        // Check Instance
        if (!instance || this._utilities.whatIs(instance) !== 'object') {
            errors.schema = 'You did not submit a valid object to validate';
            return failed(errors);
        }

        // Check Required Fields, if they exist
        if (archetype.required && archetype.required.length) {
            var required = this._validators.required(archetype.required, instance);
            if (required) {
                for (prop in required) {
                    errors[prop] = required[prop];
                }
            }
        }

        // Validate Object Root Properties
        var keys1 = Object.keys(instance);
        var idx1 = keys1.length;
        while (idx1--) {
            if (keys1[idx1] === 'servant') {
                continue;
            } else if (!archetype.properties[keys1[idx1]]) {
                // Check If Allowed Property
                errors[keys1[idx1]] = keys1[idx1] + ' is not allowed';
            } else if (archetype.properties[keys1[idx1]] && archetype.properties[keys1[idx1]].type && this._utilities.whatIs.call(this, instance[keys1[idx1]]) !== archetype.properties[keys1[idx1]].type) {
                // Check If Valid Type
                errors[keys1[idx1]] = 'Invalid type';
            } else if (archetype.properties[keys1[idx1]] && this._utilities.whatIs.call(this, instance[keys1[idx1]]) === 'array' && instance[keys1[idx1]].length) {
                // Check If Array
                this._validateArray(errors, archetype.properties[keys1[idx1]], instance[keys1[idx1]], keys1[idx1]);
            } else if (archetype.properties[keys1[idx1]] && archetype.properties[keys1[idx1]].$ref) {
                // Check If Nested Archetype
                var error = this._validateNestedArchetype(errors, archetype.properties[keys1[idx1]], instance[keys1[idx1]]);
                if (error) errors[keys1[idx1]] = error;
            } else {
                // Check If String Or Number Property, Then Validate
                var error = this._validateProperty(errors, archetype.properties[keys1[idx1]], instance[keys1[idx1]], keys1[idx1]);
                if (error) errors[keys1[idx1]] = error;
            }
        }

        // Callback Failed
        if (Object.keys(errors).length) return failed({
            error: "ValidationFailed",
            errors: errors
        });
        // Callback Success
        return success(instance);

    }; // Servant.validate


    /**
     *
     * Initialize Uploadable Archetypes
     *
     *  upload_file_input_class     // Class of file input field for onchange listener used to upload files
     *  upload_dropzone_class       // Class of dropzone elements for drop listener
     *  upload_image_preview_id     // ID of image preview container to which img elements will be appended
     *  upload_success_callback     // Upload success callback
     *  upload_failed_callback      // Ppload failed callback
     *  upload_started_callback     // Fired when uploading has begun
     *  upload_finished_callback    // Fired when uploading has finished
     *  upload_progress_callback    // Upload progress callback.  Returns percentage, bytes loaded, bytes total as params
     *  upload_queue_callback       // Upload queue callback.  Every time a new upload begins, this is fired with the queue_number and total as params
     *
     *  Set the Servant.uploadable_archetype_record_id variable with an existing Archetype Record's ID to update it with a new file
     *
     */
    Servant.initializeUploadableArchetypes = function(options) {
        var self = this;

        if (options.upload_file_input_class || options.upload_dropzone_class || options.upload_preview_id || options.upload_failed_callback || options.upload_progress_callback) {
            if (!options.upload_success_callback) return console.error('Servant SDK Error – You must specify a upload_success_callback if you want to work with uploadable archetypes.');
        }

        // Set Defaults
        this._upload_file_input_class = options.upload_file_input_class || null;
        this._upload_dropzone_class = options.upload_dropzone_class || null;
        this._upload_image_preview_id = options.upload_image_preview_id || null;
        this._upload_success_callback = options.upload_success_callback || null;
        this._upload_failed_callback = options.upload_failed_callback || null;
        this._upload_started_callback = options.upload_started_callback || null;
        this._upload_finished_callback = options.upload_finished_callback || null;
        this._upload_progress_callback = options.upload_progress_callback || null;
        this._upload_queue_callback = options.upload_queue_callback || null;

        // Add Listeners for all file inputs
        if (this._upload_file_input_class) {
            var file_inputs = document.getElementsByClassName(this._upload_file_input_class.replace('.', ''));
            for (var i = 0; i < file_inputs.length; ++i) {
                file_inputs[i].addEventListener("change", function() {
                    self._saveImageArchetype(this.files);
                }, false);
            }
        }

        // Add Listeners for all dropzones
        if (this._upload_dropzone_class) {
            var dropzones = document.getElementsByClassName(this._upload_dropzone_class.replace('.', ''));
            for (var i = 0; i < dropzones.length; ++i) {
                dropzones[i].addEventListener("dragenter", function(e) {
                    e.stopPropagation();
                    e.preventDefault();
                }, false);
                dropzones[i].addEventListener("dragover", function(e) {
                    e.stopPropagation();
                    e.preventDefault();
                }, false);
                dropzones[i].addEventListener("drop", function(e) {
                    e.stopPropagation();
                    e.preventDefault();
                    self._saveImageArchetype(e.dataTransfer.files)
                }, false);
            }
        }
    }


    /**
     * Save Archetype to Servant's API
     */
    Servant.saveArchetype = function(archetype, instance, success, failed) {
        // Check Params
        if (!this.servant) return console.error('Servant SDK Error – You have not set a servant to use.  Set the Servant.servant variable to the servant you would like to use');
        if (!archetype) return console.error('Servant SDK Error – The saveArchetype() method requires an archetype parameter');
        if (!instance) return console.error('Servant SDK Error – The saveArchetype() method requires an archetype instance to save');
        if (!success) return console.error('Servant SDK Error – The saveArchetype() method requires a success callback');
        if (!failed) return console.error('Servant SDK Error – The saveArchetype() method requires a failed callback');

        if (instance._id && instance._id.length) {
            var url = '/data/servants/' + this.servant._id + '/archetypes/' + archetype + '/' + instance._id + '?access_token=' + this._token;
            this._callAPI('PUT', url, instance, function(response) {
                success(response);
            }, function(error) {
                failed(error);
            });
        } else {
            var url = '/data/servants/' + this.servant._id + '/archetypes/' + archetype + '?access_token=' + this._token;
            this._callAPI('POST', url, instance, function(response) {
                success(response);
            }, function(error) {
                failed(error);
            });
        }
    };


    /**
     * Show an Archetype Record on Servant
     */
    Servant.showArchetype = function(archetype, archetypeID, success, failed) {
        // Check Params
        if (!this.servant) return console.error('Servant SDK Error – You have not set a servant to use.  Set the Servant.servant variable to the servant you would like to use');
        if (!archetype) return console.error('Servant SDK Error – The showArchetype() method requires an archetype parameter');
        if (!archetypeID) return console.error('Servant SDK Error – The showArchetype() method requires an archetypeID parameter');
        if (!success) return console.error('Servant SDK Error – The showArchetype() method requires a success callback');
        if (!failed) return console.error('Servant SDK Error – The showArchetype() method requires a failed callback');

        var url = '/data/servants/' + this.servant._id + '/archetypes/' + archetype + '/' + archetypeID + '?access_token=' + this._token;
        this._callAPI('GET', url, null, function(response) {
            success(response);
        }, function(error) {
            failed(error);
        });
    };

    /**
     * Delete an Archetype Record on Servant
     */
    Servant.deleteArchetype = function(archetype, archetypeID, success, failed) {
        // Check Params
        if (!this.servant) return console.error('Servant SDK Error – You have not set a servant to use.  Set the Servant.servant variable to the servant you would like to use');
        if (!archetype) return console.error('Servant SDK Error – The deleteArchetype() method requires an archetype parameter');
        if (!archetypeID) return console.error('Servant SDK Error – The deleteArchetype() method requires an archetypeID parameter');
        if (!success) return console.error('Servant SDK Error – The deleteArchetype() method requires a success callback');
        if (!failed) return console.error('Servant SDK Error – The deleteArchetype() method requires a failed callback');

        var url = '/data/servants/' + this.servant._id + '/archetypes/' + archetype + '/' + archetypeID + '?access_token=' + this._token;
        this._callAPI('DELETE', url, null, function(response) {
            success(response);
        }, function(error) {
            failed(error);
        });
    };

    /**
     * Gets User and their Servants which have given permission to this application
     */
    Servant.getUserAndServants = function(success, failed) {
        var self = this;
        var url = '/data/servants?access_token=' + this._token;
        this._callAPI('GET', url, null, function(response) {
            if (self._cache) {
                self.setUser(response.user);
                self.setServants(response.servants);
            }
            return success(response);
        }, function(error) {
            return failed(error);
        });
    };

    /**
     * Show Servant
     */
    Servant.showServant = function(servantID, success, failed) {
        var self = this;
        var url = '/data/servants/' + servantID + '?access_token=' + this._token;
        this._callAPI('GET', url, null, function(response) {
            if (self._cache) {
                self.setServant(response);
            }
            return success(response);
        }, function(error) {
            return failed(error);
        });
    };

    /**
     * Query Archetype Records On Servant
     */
    Servant.queryArchetypes = function(archetype, criteria, success, failed) {
        // Check Params
        if (!this.servant) return console.error('Servant SDK Error – You have not set a servant to use.  Set the Servant.servant variable to the servant you would like to use');
        // Fix variable assignment
        if (typeof criteria === 'function' && !failed) {
            failed = success;
            success = criteria;
            criteria = false;
        }
        if (!archetype) return console.error('Servant SDK Error – The queryArchetypes() method requires an archetype parameter');
        if (!success) return console.error('Servant SDK Error – The queryArchetypes() method requires a success callback');
        if (!failed) return console.error('Servant SDK Error – The queryArchetypes() method requires a failed callback');
        // Build URL
        var url = '/data/servants/' + this.servant._id + '/archetypes/' + archetype + '?access_token=' + this._token;
        if (criteria) url = url + '&criteria=' + JSON.stringify(criteria);
        // Call API
        this._callAPI('GET', url, null, function(response) {
            success(response);
        }, function(error) {
            failed(error);
        });
    };

    /**
     * Query Archetypes Convenience Method – Show Recent
     */
    Servant.archetypesRecent = function(archetype, page, success, failed) {
        // Check Page parameter
        if (typeof page === 'function' && !failed) {
            failed = success;
            success = page;
            page = 1;
        }
        if (page) page = parseInt(page);

        // Set criteria
        var criteria = {
            query: {},
            sort: {
                created: -1
            },
            page: page
        };

        Servant.queryArchetypes(archetype, criteria, function(response) {
            return success(response);
        }, function(error) {
            return failed(error);
        });
    };

    /**
     * Query Archetypes Convenience Method – Show Oldest
     */
    Servant.archetypesOldest = function(archetype, page, success, failed) {
        // Check Page parameter
        if (typeof page === 'function' && !failed) {
            failed = success;
            success = page;
            page = 1;
        }
        if (page) page = parseInt(page);
        // Criteria
        var criteria = {
            query: {},
            sort: {
                created: 1
            },
            page: page
        };
        // Perform API Call
        Servant.queryArchetypes(archetype, criteria, function(response) {
            return success(response);
        }, function(error) {
            return failed(error);
        });
    };

    /**
     * Servant Pay – Charge
     */
    Servant.servantpayCharge = function(amount, currency, success, failed) {
        var self = this;

        // Check Params
        if (!this.servant) return console.error('Servant SDK Error – You have not set a servant to use.  Set the Servant.servant variable to the servant you would like to use');
        if (typeof amount !== 'number' || amount.toString().indexOf('.') > -1) return console.error('Servant SDK Error – Amount must be a number and an integer (no decimals allowed) representing the total cents of the amount.');
        if (!currency || typeof currency !== 'string')  return console.error('Servant SDK Error – Currency parameter must be included and be a string');

        var url = '/data/servants/' + this.servant._id + '/servant_pay/charge?access_token=' + this._token;
        this._callAPI('POST', url, {
            amount: amount,
            currency: currency
        }, function(response) {
            return success(response);
        }, function(error) {
            return failed(error);
        });
    };

    /**
     * Servant Pay – Subscription Create
     */
    Servant.servantpaySubscriptionCreate = function(plan_id, success, failed) {
        var self = this;

        // Check Params
        if (!this.servant) return console.error('Servant SDK Error – You have not set a servant to use.  Set the Servant.servant variable to the servant you would like to use');
        if (!plan_id || typeof plan_id !== 'string') return console.error('Servant SDK Error – Please submit a valid plan_id parameter as a string');

        var url = '/data/servants/' + this.servant._id + '/servant_pay/subscription?access_token=' + this._token;
        this._callAPI('POST', url, {
            plan_id: plan_id
        }, function(response) {
            return success(response);
        }, function(error) {
            return failed(error);
        });
    };

    /**
     * Servant Pay – Subscription Update
     */
    Servant.servantpaySubscriptionUpdate = function(plan_id, success, failed) {
        var self = this;

        // Check Params
        if (!this.servant) return console.error('Servant SDK Error – You have not set a servant to use.  Set the Servant.servant variable to the servant you would like to use');
        if (!plan_id || typeof plan_id !== 'string') return console.error('Servant SDK Error – Please submit a valid plan_id parameter as a string');

        var url = '/data/servants/' + this.servant._id + '/servant_pay/subscription?access_token=' + this._token;
        this._callAPI('PUT', url, {
            plan_id: plan_id
        }, function(response) {
            return success(response);
        }, function(error) {
            return failed(error);
        });
    };

    /**
     * Servant Pay – Subscription Cancel
     */
    Servant.servantpaySubscriptionCancel = function(success, failed) {
        var self = this;

        // Check Params
        if (!this.servant) return console.error('Servant SDK Error – You have not set a servant to use.  Set the Servant.servant variable to the servant you would like to use');

        var url = '/data/servants/' + this.servant._id + '/servant_pay/subscription?access_token=' + this._token;
        this._callAPI('DELETE', url, null, function(response) {
            return success(response);
        }, function(error) {
            return failed(error);
        });
    };

    /**
     * Servant Pay – Customer Delete
     */
    Servant.servantpayCustomerDelete = function(success, failed) {
        var self = this;

        // Check Params
        if (!this.servant) return console.error('Servant SDK Error – You have not set a servant to use.  Set the Servant.servant variable to the servant you would like to use');

        var url = '/data/servants/' + this.servant._id + '/servant_pay/customer?access_token=' + this._token;
        this._callAPI('DELETE', url, null, function(response) {
            return success(response);
        }, function(error) {
            return failed(error);
        });
    };





}(this));


// end