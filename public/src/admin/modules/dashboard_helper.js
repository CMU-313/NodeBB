import * as Benchpress from 'benchpressjs';
import * as bootbox from 'bootbox';

export function renderCustomRangeModal({ set, updateFn }) {
    const targetEl = $('[data-action="updateGraph"][data-units="custom"]');

    Benchpress.render('admin/partials/pageviews-range-select', {}).then(function (html) {
        const modal = bootbox.dialog({
            title: '[[admin/dashboard:page-views-custom]]',
            message: html,
            buttons: {
                submit: {
                    label: '[[global:search]]',
                    className: 'btn-primary',
                    callback: submit,
                },
            },
        }).on('shown.bs.modal', function () {
            const date = new Date();
            const today = date.toISOString().slice(0, 10);
            date.setDate(date.getDate() - 1);
            const yesterday = date.toISOString().slice(0, 10);

            modal.find('#startRange').val(targetEl.attr('data-startRange') || yesterday);
            modal.find('#endRange').val(targetEl.attr('data-endRange') || today);
        });

        function submit() {
            // NEED TO ADD VALIDATION HERE FOR YYYY-MM-DD
            const formData = modal.find('form').serializeObject();
            const validRegexp = /\d{4}-\d{2}-\d{2}/;

            // Input validation
            if (!formData.startRange && !formData.endRange) {
                // No range? Assume last 30 days
                updateFn(set, 'days');
                return;
            } else if (!validRegexp.test(formData.startRange) || !validRegexp.test(formData.endRange)) {
                // Invalid Input
                modal.find('.alert-danger').removeClass('hidden');
                return false;
            }

            let until = new Date(formData.endRange);
            until.setDate(until.getDate() + 1);
            until = until.getTime();
            const amount = (until - new Date(formData.startRange).getTime()) / (1000 * 60 * 60 * 24);

            updateFn(set, 'days', until, amount);

            // Update "custom range" label
            targetEl.attr('data-startRange', formData.startRange);
            targetEl.attr('data-endRange', formData.endRange);
            targetEl.html(formData.startRange + ' &ndash; ' + formData.endRange);
        }
    });
}
