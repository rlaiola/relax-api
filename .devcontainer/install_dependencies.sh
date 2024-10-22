#! /bin/sh
#========================================================================
# Copyright Universidade Federal do Espirito Santo (Ufes)
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.
#
# This program is released under license GNU GPL v3+ license.
#
#========================================================================

# Clone RelaX repo* and checkout the static files (branch gh-pages)
rm -rf dist && \
mkdir dist && \
cd dist && \
git clone https://github.com/rlaiola/relax.git && \
cd relax && \
git config --global --add safe.directory . && \
git checkout origin/gh-pages && \
git checkout gh-pages && \
git branch && \
cd ../..

# Install dependencies (chromium)
apt-get update \
&& apt-get install -y --no-install-recommends \
    chromium \
&& apt-get clean \
&& rm -rf /var/lib/apt/lists/*

# Set environment variables
export NODE_OPTIONS=--openssl-legacy-provider
