#MISIS ACM Server
[![Built with Grunt](https://cdn.gruntjs.com/builtwith.png)](http://gruntjs.com/) [![NPM](https://img.shields.io/badge/npm-2.9.0-green.svg)](http://npmjs.com)

----------

###Based on [Nodejs](http://nodejs.org/) + [Angular](http://angularjs.org/) + [Express](http://expressjs.com/) + [Jade](http://jade-lang.com/) + [Sass](http://sass-lang.com/) + [Grunt](http://gruntjs.com/).

### Development environment setup
####1. Prerequisites

* [Nodejs](http://www.nodejs.org/)
* [Node Package Manager](https://npmjs.org/) (NPM)
* [Git](http://git-scm.com/) (Git-scm)
* [Ruby](http://www.ruby-lang.org/en/downloads/) (Sass runtime environment)

####2. Dependencies
* [Grunt](http://gruntjs.com/) (task automation)
* [Bower](http://bower.io/) (Web package management)
* [Sass](http://sass-lang.com/) (css tool)
```
npm install bower -g
npm install grunt-cli -g
gem install sass
```
####3. Installation
#####1. Cloning repo
```
$ git clone https://github.com/IPRIT/misis-acm-server.git
```
#####2. Install required **node** modules
```
npm install
```
#####3. **Bower** modules installation:
```
bower install
```
#####4. Running **Grunt**
```
grunt 
```

####4. Running application
To start the web server for production, run:
```
npm build-all-start
```

To access the local server, enter the following URL into your web browser:
```
http://localhost:3000/
```

###Photos

#### Real-time monitor table
![Awesome screenshot 1](http://s.twosphere.ru/screenshots/12-23-15_23-27-31.png)
----------
#### Updating status list in real time (not in frozen state)
![Awesome screenshot 2](http://s.twosphere.ru/screenshots/12-23-15_23-32-49.png)
----------
#### List of contests with custom groups
![Awesome screenshot 3](http://s.twosphere.ru/screenshots/12-23-15_23-35-54.png)
----------
#### The easiest way to create custom contest
![Awesome screenshot 4](http://s.twosphere.ru/screenshots/12-23-15_23-40-27.png)
----------
#### Admin panel
![Awesome screenshot 5](http://s.twosphere.ru/screenshots/12-23-15_23-42-25.png)
----------