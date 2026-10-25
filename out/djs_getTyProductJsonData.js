function getJsonValue(typhoon_type, json) {
    this.success = true;
    this.errorMsg = '';
    var thisJson = json[typhoon_type];
    this.caption_has_datetime = thisJson['caption_has_datetime'];

    var getLevelType = function(json) {
        if (typeof json['refurl'] !== 'undefined') {
            return 'refurl';
        }

        if (typeof json['subdatatype'] !== 'undefined') {
            return 'subdatatype';
        }

        if (typeof json['thirdlevel'] !== 'undefined') {
            return 'thirdlevel';
        }

        if (typeof json['thirdlevel_title_from_first'] !== 'undefined') {
            return 'thirdlevel_title_from_first';
        }

        if (typeof json['forthlevel'] !== 'undefined') {
            return 'forthlevel';
        }

        return '';
    };

    var level = getLevelType(thisJson);

    var getFirstKey = function(json) {
        for (var key in json) {
            return key;
        }
    };

    var getKeys = function(object) {
        var tmp = [];
        tmp = $.map(object, function(val, key) {
            return key;
        });
        return tmp;
    };

    var getSpecifyObjectValue = function(object, obj_key) {
        var tmp = [];
        if (Object.prototype.toString.call(object) === '[object Array]') {
            tmp = $.map(object, function(val, key) {
                return val[obj_key];
            });
        } else {
            tmp = [object];
        }
        return tmp;
    };

    var getObjectFromArray = function(array) {
        var sortable = [];
        $.each(array, function(index, sub_object) {
            var obj_key = getFirstKey(sub_object);
            var obj_val = sub_object[obj_key];
            sortable.push([obj_key, obj_val]);
        });
        return sortable.sort(function(a, b) {
            return parseInt(a[0]) - parseInt(b[0]);
        });
    };

    var objLv1 = function() {
        this.level1 = function() {
            var text = getSpecifyObjectValue(thisJson[level], '0');
            var val = getSpecifyObjectValue(thisJson[level], '1');
            return {
                'success': val.length > 0 ? true : false,
                'title': '',
                'name': 'typhoon_item_option',
                'text': text,
                'value': val
            };
        };
        this.level2 = function() {
            return {
                'success': false
            };
        };
        this.level3 = function() {
            return {
                'success': false
            };
        };
        this.level4 = function() {
            return {
                'success': false
            };
        };
    };

    var objLv2 = function() {
        this.level1 = function() {
            var text = getSpecifyObjectValue(thisJson[level], 'name');
            var val = getKeys(thisJson[level]);
            return {
                'success': val.length > 0 ? true : false,
                'title': '',
                'name': 'typhoon_item_name',
                'text': text,
                'value': val
            };
        };
        this.level2 = function(lv1) {
            var text = getSpecifyObjectValue(thisJson[level][lv1]['sets'], '0');
            var val = getSpecifyObjectValue(thisJson[level][lv1]['sets'], '1');
            return {
                'success': val.length > 0 ? true : false,
                'title': 'Date',
                'name': 'typhoon_item_option',
                'text': text,
                'value': val
            };
        };
        this.level3 = function() {
            return {
                'success': false
            };
        };
        this.level4 = function() {
            return {
                'success': false
            };
        };
    };

    var objLv3 = function(title_array) {
        title_array = title_array || ['', '', ''];
        this.level1 = function() {
            var keyArray = getKeys(thisJson[level]);
            return {
                'success': keyArray.length > 0 ? true : false,
                'title': title_array[0] || '網格',
                'name': 'typhoon_domain',
                'text': keyArray,
                'value': keyArray
            };
        };
        this.level2 = function(lv1) {
            var keyArray = getKeys(thisJson[level][lv1]);
            return {
                'success': keyArray.length > 0 ? true : false,
                'title': title_array[1] || '分析場',
                'name': 'typhoon_field',
                'text': keyArray,
                'value': keyArray
            };
        };
        this.level3 = function(lv1, lv2) {
            var arrayArray = getObjectFromArray(thisJson[level][lv1][lv2]);
            var keyArray = getSpecifyObjectValue(arrayArray, '0');
            var valArray = getSpecifyObjectValue(arrayArray, '1');
            return {
                'success': valArray.length > 0 ? true : false,
                'title': title_array[2] || 'Date',
                'name': 'typhoon_date',
                'text': keyArray,
                'value': valArray
            };
        };
        this.level4 = function() {
            return {
                'success': false
            };
        };
    };

    var objLv4 = function(title_array) {
        title_array = title_array || ['', '', '', ''];
        this.level1 = function() {
            var keyArray = getKeys(thisJson[level]);
            return {
                'success': keyArray.length > 0 ? true : false,
                'title': title_array[0] || '網格',
                'name': 'typhoon_domain',
                'text': keyArray,
                'value': keyArray
            };
        };
        this.level2 = function(lv1) {
            var keyArray = getKeys(thisJson[level][lv1]);
            return {
                'success': keyArray.length > 0 ? true : false,
                'title': title_array[1] || '分析場',
                'name': 'typhoon_field',
                'text': keyArray,
                'value': keyArray
            };
        };
        this.level3 = function(lv1, lv2) {
            var keyArray = getKeys(thisJson[level][lv1][lv2]);
            return {
                'success': keyArray.length > 0 ? true : false,
                'title': title_array[2] || 'Date',
                'name': 'typhoon_date',
                'text': keyArray,
                'value': keyArray
            };
        };
        this.level4 = function(lv1, lv2, lv3) {
            var arrayArray = getObjectFromArray(thisJson[level][lv1][lv2][lv3]);
            var keyArray = getSpecifyObjectValue(arrayArray, '0');
            var valArray = getSpecifyObjectValue(arrayArray, '1');
            return {
                'success': keyArray.length > 0 ? true : false,
                'title': title_array[3] || 'Tau',
                'name': 'typhoon_tau',
                'text': keyArray,
                'value': valArray
            };
        };
    };

    var instance;
    switch (level) {
        case 'refurl':
            instance = new objLv1();
            this.levelNum = 1;
            break;
        case 'subdatatype':
            instance = new objLv2();
            this.levelNum = 2;
            break;
        case 'thirdlevel':
            instance = new objLv3(thisJson.title);
            this.levelNum = 3;
            break;
        case 'thirdlevel_title_from_first':
            instance = new objLv3(thisJson.title);
            this.levelNum = 3;
            break;
        case 'forthlevel':
            instance = new objLv4(thisJson.title);
            this.levelNum = 4;
            break;
        default:
            this.success = false;
            this.errorMsg = 'getJsonValue() cannot recognize this json format';
            this.levelNum = 0;
    }

    if (this.success === true) {
        this.levelType = level;

        this.getLevel1 = function() {
            return instance.level1();
        };

        this.getLevel2 = function(lv1) {
            return instance.level2(lv1);
        };

        this.getLevel3 = function(lv1, lv2) {
            return instance.level3(lv1, lv2);
        };

        this.getLevel4 = function(lv1, lv2, lv3) {
            return instance.level4(lv1, lv2, lv3);
        };
    }
}
