#!/usr/bin/env python
# -*- encoding: utf-8; py-indent-offset: 4 -*-

# (c) 2020 Derdack GmbH
#          Derdack Support <support@derdack.com>

# This is free software;  you can redistribute it and/or modify it
# under the  terms of the  GNU General Public License  as published by
# the Free Software Foundation in version 2.  check_mk is  distributed
# in the hope that it will be useful, but WITHOUT ANY WARRANTY;  with-
# out even the implied warranty of  MERCHANTABILITY  or  FITNESS FOR A
# PARTICULAR PURPOSE. See the  GNU General Public License for more de-
# tails. You should have  received  a copy of the  GNU  General Public
# License along with GNU Make; see the file  COPYING.  If  not,  write
# to the Free Software Foundation, Inc., 51 Franklin St,  Fifth Floor,
# Boston, MA 02110-1301 USA.

register_notification_parameters("derdack", Dictionary(
    optional_keys = ['originator'],
    elements = [
        ("url", TextAscii(
            title = _("REST API URL"),
            help = _("The URL of your Enterprise Alert REST Service API, e.g. https://your-enterprisealert-server/EAWebService/rest/events"),
            size = 200,
            allow_empty = False,
        )),
        ("password", TextAscii(
            title = _("API Key"),
            help = _("The API key of your REST service."),
            size = 100,
            allow_empty = False,
        ))
    ]
))
