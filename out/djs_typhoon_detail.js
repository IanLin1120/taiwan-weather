/* global moment, lang, global, lib */

$(function () {
    var product_height = $(window).height() - 300;
    if (global.device === 'desktop') {
        merge_multi_table();

        function merge_multi_table () {
            var affect_count = $('.affect-multi-times').length;
            if (!affect_count) {
                return;
            }

            var $main = $('.affect-multi-times:first');
            var affect_times = 1;
            $('#typhoon_abstract .affect-multi-times:gt(0)').each(function () {
                affect_times++;
                $(this).find('td').each(function (row, td) {
                    var $current_row = $main.find('tr').eq(row);
                    if (row === 7 || row === 10 || row === 11) {
                        $current_row.find('td').attr('colspan', affect_count);
                    } else {
                        $current_row.append(td);
                    }
                });
                $(this).remove();
            });

            $('.affect-multi-times tr:eq(0) td').css({width: (80 / affect_times) + '%'});
        }
    }

    var group_template = $('#group_template').get(0).outerHTML;
    var product_template = $('#product_template .card').get(0).outerHTML;
    $.each(['FCT', 'OBS', 'ReAna'], function (i, group) {
        if (global.login === 'unlogin' && group !== "OBS") {
            return;
        }

        if (typeof global.meta.meta.Group[group] === 'undefined') {
            return true;
        }

        var $template = $(group_template);
        $template.removeAttr('id');
        $template.find('.card-header').attr('data-target', '#' + group);
        $template.find('h5').html(lang[group] + ' <i class="fas fa-sort-down"></i>');
        $template.find('.product_template').attr('id', group + '_products').empty();
        $template.find('.collapse').attr('id', group);

        $('#collapse_parent').after($template);

        var $group_products = $('#' + group + '_products');
        $.each(global.meta.meta['Group'][group]['datatype_c'], function (j, product_text) {
            var product_name = global.meta.meta['Group'][group]['datatype_e'][j];

            var $product_template = $(product_template);
            $product_template.find('.card-header').attr('data-target', '#' + product_name);
            $product_template.find('h5').text(product_text);

            var $product = $product_template.find('.collapse');
            var $introduction = $product.find(".description");

            $product.attr('id', product_name);
            $product.attr('data-parent', '#' + group + '_products');
            $product.attr('product', product_name);
            $product.attr('loaded', false);
            $product.attr('group', group);
            $product.attr('product_text', product_text);

            if (lang[product_name]) {
                $introduction.addClass("mt-4");
                $introduction.html('<small>' + global.product[product_name] + '</small>');
            }

            $group_products.append($product_template);
        });

    });

    $('#typhoon_summary').append(global.product['TyphoonSummary']);
 
    var product = null;
    var $product = null;
    var product_group = null;

    global.play_info = {
        index: -1,
        list: [],
        size: 0,
        timer: null,
        interval: null,
        is_play: false
    };

    function stop_play () {
        if (global.play_info.timer) {
            clearInterval(global.play_info.timer);
        }

        global.play_info.index = -1;
        global.play_info.list = [];
        global.play_info.size = 0;
        global.play_info.timer = null;
        global.play_info.is_play = false;

        if ($product) {
            $product.find('.image_player .active').removeClass('active');
        }
    }

    $('#collapse_parent').on('show.bs.collapse', function () {
        if (global.play_info.timer) {
            clearInterval(global.play_info.timer);
        }

        stop_play();
    });

    function set_current_product ($event_target) {
        product = $event_target.closest('.collapse').attr('id');
        $product = $('#' + product);
        product_group = $product.attr('group');

        global.play_info.interval = parseInt($product.find('.play_speed').val());
    }

    global.display_handler = {};
    $('#OBS_products, #FCT_products, #ReAna_products').on('shown.bs.collapse', function () {
        set_current_product($(this).find('.collapse.show'));

        if ($product.attr('loaded') === 'false') {
            $.ajax({
                url: global.controller + '/get_product',
                type: 'POST',
                dataType: 'json',
                data: {
                    year: global.year,
                    name: global.name,
                    product: product
                },
                success: function (response) {
                    $product.attr('loaded', true);

                    global.display_handler[product] = new getJsonValue(product, response);

                    render_product(1);
                },
                error: function () {
                    $product.attr('loaded', true);
                    no_product(product);
                }
            });
        }

    });

    function render_product (current_level) {
        var display_handler = global.display_handler[product];

        if (current_level > display_handler.levelNum) {
            return;
        }

        var selected_values = [];
        $product.find('.show-filter label.active, .show-filter select').each(function () {
            selected_values.push($(this).find('input').val() || $(this).find('option:selected').val());
        });
        var lv_content = display_handler['getLevel' + current_level].apply(null, selected_values);
        if (lv_content.success === false) {
            no_product();
        }

        if (current_level === display_handler.levelNum) {
            generate_select_area(lv_content, current_level);

            var selected_file = $('.multi_item_select', $product).find('option:selected').val();
            var ext = selected_file.substr((selected_file.lastIndexOf('.') + 1));
            var is_image = ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'gif';
            if (is_image && $('.multi_item_select', $product).find('option').length > 1) {
                show_image_player();
            }
        } else {
            generate_check_area(lv_content, current_level);
        }
    }

    function show_image_player () {
        var html = '';
        html += '<div class="image_player mt-2 p-2">';
        html += '<i class="mr-2 mt-1 rounded-circle fas fa-chevron-circle-left prev_image" title="' + lang['loop_prev'] + '"></i>';
        html += '<i class="mr-2 mt-1 rounded-circle fas fa-pause-circle pause_play" title="' + lang['loop_stop'] + '"></i>';
        html += '<i class="mr-2 mt-1 rounded-circle fas fa-play-circle start_play" title="' + lang['loop_play'] + '"></i>';
        html += '<i class="mr-2 mt-1 rounded-circle fas fa-chevron-circle-right next_image" title="' + lang['loop_next'] + '"></i>';
        html += '<div class="play_speed_wrapper">';
        html += lang['loop_speed'];
        html += ' <input type="number" step="500" class="play_speed" min="500" value="1000"> ';
        html += '(' + lang['loop_speed_unit'] + ')';
        html += '</div>';
        html += '</div>';

        $product.find('.download_button').before(html);
        global.play_info.interval = 1000;

        if (global.device !== 'desktop') {
            $product.find('.image_player').addClass('text-center');
            $('.play_speed', $product).before('<i class="speed_down fas fa-caret-left"></i>').after('<i class="speed_up fas fa-caret-right"></i>');
            $product.find('.select_all').trigger('click');
        }
    }

    $(document).on('click', '.speed_down', function () {
        var $play_speed = $('.play_speed', $product);
        $play_speed.val(parseInt($play_speed.val()) - 500);
        $play_speed.trigger('change');
    });

    $(document).on('click', '.speed_up', function () {
        var $play_speed = $('.play_speed', $product);
        $play_speed.val(parseInt($play_speed.val()) + 500);
        $play_speed.trigger('change');
    });

    function display_file (selected_file) {
        if ($.isArray(selected_file)) {
            return;
        }

        var ext = selected_file.substr((selected_file.lastIndexOf('.') + 1));
        if (ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'gif') {
            show_img(selected_file);
        } else if (ext === 'pdf') {
            show_pdf(selected_file);
        } else {
            show_txt(selected_file);
        }

        return ext;
    }

    function show_img (image_name, is_play) {
        var src = global.controller + '/get_image?image=' + encodeURIComponent(global.year + '/' + global.name + '/' + product_group + '/' + product + '/' + image_name) + (is_play ? '&is_play=true' : '');
        lib.image_loaded(src, function (img) {
            img.className = 'product_image rounded img-fluid';
            $product.find('.display_area').html(img);
        }, function () {
            $product.find('.display_area').html('<img src="' + global.base_url + 'pages/public/typhoon_detail/no_image.svg" class="rounded img-fluid">');
        });
    }

    function show_pdf (pdf_name) {
        var src = global.controller + '/get_pdf?pdf=' + encodeURIComponent(global.year + '/' + global.name + '/' + product_group + '/' + product + '/' + pdf_name);

        if (global.device !== 'desktop') {
            $product.find('.display_area').removeClass('col-8').addClass('col-12').html('<div class="text-center product_pdf p-3"><a href="' + src + '"><i class="fa fa-file-pdf" style="font-size: 5rem"></i><br><div class="mt-3">' + lang['click_to_open_pdf'] + '</div></a></div>');
        } else {
            $product.find('.display_area').html('<iframe class="product_pdf w-100" src="' + src + '" height="' + product_height + '"></iframe>');
        }
    }

    function show_txt (txt_name) {
        var src = global.controller + '/get_txt?txt=' + encodeURIComponent(global.year + '/' + global.name + '/' + product_group + '/' + product + '/' + txt_name);

        if (global.device !== 'desktop') {
            $product.find('.display_area').removeClass('col-8').addClass('col-12').html('<div class="text-center product_txt p-3"><a href="' + src + '"><i class="fa fa-file-alt" style="font-size: 5rem"></i><br><div class="mt-3">' + lang['click_to_open_txt'] + '</div></a></div>');
        } else {
            $product.find('.display_area').html('<iframe class="product_txt w-100" src="' + src + '" height="' + product_height + '"></iframe>');
        }
    }

    function generate_check_area (data, current_level) {
        var html = '<div class="show-filter" level="' + current_level + '">';
        if (global.device !== 'desktop') {
            html += (data.title || $product.attr('product_text'));
            html += '<select class="ml-2">';
            for (var index in data.text) {
                if (data.text.hasOwnProperty(index)) {
                    html += '<option value="' + data.value[index] + '">' + document.createTextNode(data.text[index]).wholeText + '</option>';
                }
            }
            html += '</select>';
        } else {
            html += '<h5 class="item_title">' + (data.title || $product.attr('product_text')) + '</h5>';
            for (var index in data.text) {
                if (data.text.hasOwnProperty(index)) {
                    html += '<label class="p-2 m-1">' + document.createTextNode(data.text[index]).wholeText + '<input type="radio" value="' + data.value[index] + '" class="" name="' + product + '_' + data.name + '"></label>';
                }
            }
            html += '</div>';
        }

        $('.select_area', $product).append(html);
        $('.select_area .show-filter:last label:first', $product).trigger('click');
        $('.select_area .show-filter:last select option:first', $product).trigger('change');
    }

    function generate_select_area (data, current_level) {
        global.play_info.is_mobile_and_not_date = true;
        if (global.device !== 'desktop' && typeof data.text[0] !== 'undefined') {
            // date ex: 2010-09-17 08:32
            if (data.text[0].length === 16 && data.text[0][4] === '-' && data.text[0][7] === '-' && data.text[0][10] === ' ' && data.text[0][13] === ':') {
                global.play_info.is_mobile_and_not_date = false;
            }

            // tau
            if ((data.text[0].length === 3 && !isNaN(parseInt(data.text[0])))) {
                global.play_info.is_mobile_and_not_date = false;
            }
        } else {
            global.play_info.is_mobile_and_not_date = false;
        }

        var html = '<div class="show-filter" level="' + current_level + '">';
        if (global.play_info.is_mobile_and_not_date && data.text.length > 1) {
            html += (data.title || $product.attr('product_text'));
        } else if (global.device !== 'desktop') {
        } else {
            html += '<h5 class="item_title">' + (data.title || $product.attr('product_text')) + '</h5>';
        }

        html += '<label class="p-2 select_all_label d-none d-lg-inline-block"><input type="checkbox" class="select_all"> ' + lang['select_all'] + '</label>';
        if (global.play_info.is_mobile_and_not_date && data.text.length > 1) {
            html += '<select class="multi_item_select ml-2">';
        } else {
            html += '<select multiple="multiple" class="multi_item_select w-100 d-none d-lg-block" size="' + (data.text.length > 10 ? 10 : data.text.length) + '">';
        }

        var btn_display_class = "";
        if (Number(global.level) < 2) {
	    btn_display_class = "not_show";
        }       
 
        for (var index in data.text) {
            if (data.text.hasOwnProperty(index)) {
                html += '<option value="' + data.value[index] + '">' + document.createTextNode(data.text[index]).wholeText + '</option>';
            }
        }
        html += '</select>';
        html += '</div>';
        html += '<div class="funtions order-2">';
        html += '<button type="button" class="download_button btn btn-light d-none d-lg-block mt-4 ' + btn_display_class + '">' + lang['download_text'] + '</button>';
        html += '</div>';

        $('.funtions', $product).remove();
        $('.select_area', $product).append(html);
        $('.multi_item_select', $product).find('option:first').prop('selected', true).trigger('change');

        if (global.device !== 'desktop') {
            $product.find('.funtions').appendTo($('.function_area', $product));
        }
    }

    $(document).on("change", ".show-filter select", function (e) {
        if ($(this).hasClass('multi_item_select')) {
            return;
        }

        var current_level = parseInt($(this).closest('.show-filter').attr('level'));
        $product.find('.select_area .show-filter:gt(' + (current_level - 1) + ')').remove();
        render_product(current_level + 1);
    });

    $(document).on("click", ".show-filter label", function (e) {
        if ($(this).hasClass('select_all_label')) {
            return;
        }

        var $parent_div = $(this).parent('div');
        $parent_div.find('.active').removeClass('active');
        $(this).addClass('active');

        var current_level = parseInt($(this).closest('.show-filter').attr('level'));
        $product.find('.select_area .show-filter:gt(' + (current_level - 1) + ')').remove();
        render_product(current_level + 1);
    });

    $(document).on('change', '.multi_item_select', function (e) {
        var is_human_change = e.originalEvent !== undefined;
        if (is_human_change) {
            stop_play();
        }

        if (!global.play_info.is_mobile_and_not_date) {
            stop_play();
        }

        if ($(this).prop('multiple')) {
            global.play_info.list = $(this).children("option:selected").toArray().map(item => item.value);
        } else {
            global.play_info.list = [document.createTextNode($(this).val()).wholeText];
        }
        global.play_info.size = global.play_info.list.length;
        if (global.play_info.size === 1) {
            display_file(global.play_info.list[0]);
            $product.find('.pause_play').removeClass('active');
        } else {
            display_file(global.play_info.list[0]);
            global.play_info.index = 0;
            $product.find('.pause_play').addClass('active');
            $product.find('.start_play').removeClass('active');
        }
    });

    $(document).on('click', '.pause_play', function () {
        $product.find('.pause_play').addClass('active');
        $product.find('.start_play').removeClass('active');
        pause_play();
    });

    $(document).on('click', '.start_play', function () {
        if (global.play_info.is_play) {
            return;
        }

        if (!global.play_info.is_mobile_and_not_date && global.play_info.size < 2) {
            $product.find('.select_all').prop('checked', false).trigger('click');
            $('.multi_item_select', $product).trigger('change');
        }

        $product.find('.pause_play').removeClass('active');
        $product.find('.start_play').addClass('active');

        start_play();
    });

    $(document).on('click', '.prev_image', function () {
        $product.find('.pause_play').addClass('active');
        $product.find('.start_play').removeClass('active');

        pause_play();
        prev_image();
    });

    $(document).on('click', '.next_image', function () {
        $product.find('.pause_play').addClass('active');
        $product.find('.start_play').removeClass('active');

        pause_play();
        next_image();
    });

    function next_image () {
        if (global.play_info.is_mobile_and_not_date) {
            var $next = $('.multi_item_select option:selected', $product).next();
            if ($next.length === 0) {
                $next = $('.multi_item_select option:first', $product).prop('selected', true);
            } else {
                $next.prop('selected', true);
            }
            $next.trigger('change');
        } else {
            global.play_info.index = ++global.play_info.index % global.play_info.size;
            show_img(global.play_info.list[global.play_info.index]);
        }
    }

    function prev_image () {
        if (global.play_info.is_mobile_and_not_date) {
            var $prev = $('.multi_item_select option:selected', $product).prev();
            if ($prev.length === 0) {
                $prev = $('.multi_item_select option:last', $product).prop('selected', true);
            } else {
                $prev.prop('selected', true);
            }
            $prev.trigger('change');
        } else {
            --global.play_info.index;
            if (global.play_info.index < 0) {
                global.play_info.index = global.play_info.size - 1;
            }
            show_img(global.play_info.list[global.play_info.index]);
        }
    }

    function start_play () {
        global.play_info.is_play = true;
        global.play_info.timer = setInterval(function () {
            next_image();

            if (!global.play_info.is_mobile_and_not_date && global.play_info.index === (global.play_info.size - 1)) {
                clearInterval(global.play_info.timer);
                global.play_info.timer = setTimeout(function () {
                    start_play();
                }, 3000);
            }
        }, global.play_info.interval);
    }

    function pause_play () {
        if (global.play_info.timer) {
            clearInterval(global.play_info.timer);
            global.play_info.timer = null;
        }
        global.play_info.is_play = false;
    }

    $(document).on('change', '.play_speed', function () {
        if ($(this).val() < 500) {
            $(this).val(500);
        }
        global.play_info.interval = parseInt($(this).val());

        if (global.play_info.is_play) {
            pause_play();
            start_play();
        }
    });

    $(document).on('click', '.select_all', function () {
        if (global.play_info.is_mobile_and_not_date) {
            return;
        }
        $product.find('.multi_item_select option').prop('selected', $(this).prop('checked'));
        if (!$(this).prop('checked')) {
            $('.multi_item_select', $product).find('option:first').prop('selected', true);
        }
        $('.multi_item_select', $product).trigger('change');
    });

    $(document).on('click', '.download_button', function () {
        if (global.play_info.list.length === 0) {
            alert(lang['download_not_select']);
            return;
        }

        var path = global.year + '/' + global.name + '/' + product_group + '/' + product + '/';
        var download_html = '<form action="' + global.controller + '/download_product" method="post" target="download" id="download_form">';
        download_html += '<input type="text" name="path" value="' + path + '">';
        download_html += '<input type="text" name="files" value="' + global.play_info.list + '">';
        download_html += '<input type="submit">';
        download_html += '</form>';
        download_html += '<iframe name="download" style="display:none;"></iframe>';

        $('body').append(download_html);
        $('#download_form').submit().remove();
    });

    function no_product () {
        var html = '';
        html += '<div class="alert alert-danger" role="alert">';
        html += lang['no_product_content'];
        html += '</div>';

        $product.find('.product_display').html(html);
    }

//    $('#OBS').collapse('show');
//    $('#Track').collapse('show');
});
