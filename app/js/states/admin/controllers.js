/*
 * Acm system
 * https://github.com/IPRIT
 *
 * Copyright (c) 2015 "IPRIT" Alex Belov, contributors
 * Licensed under the BSD license.
 * Created on 09.11.2015
 */

'use strict';

/* Controllers */

/* global angular */
angular.module('Qemy.controllers.admin', [])

    .controller('AdminBaseController', ['$scope', '$rootScope', '$state', '_', 'UserManager',
        function ($scope, $rootScope, $state, _, UserManager) {
            $scope.$emit('change_title', {
                title: 'Панель администратора | ' + _('app_name')
            });
            $scope.user = {};

            $rootScope.$broadcast('data loading');
            UserManager.getCurrentUser()
                .then(function (user) {
                    $rootScope.$broadcast('data loaded');
                    if (!user || !user.id) {
                        return $state.go('auth.form');
                    } else if (user.access_group.access_level !== 5) {
                        return $state.go('contests.list');
                    }
                    $scope.user = user;
                }
            ).catch(function (err) {
                $state.go('auth.form');
            });
        }
    ])

    .controller('AdminMenuController', ['$scope', '$rootScope', '$state', '_',
        function ($scope, $rootScope, $state, _) {
            $scope.menu = [{
                uiSref: 'admin.index',
                name: 'Контесты'
            }, {
                uiSref: 'admin.users-list',
                name: 'Пользователи'
            }, {
                uiSref: 'admin.problems',
                name: 'Задачи'
            }, {
                uiSref: 'admin.server',
                name: 'Сервер'
            }, {
                uiSref: 'admin.contests-rating.create.index',
                name: 'Рейтинги'
            }/*, {
                uiSref: 'admin.index',
                name: 'Группы пользователей'
            }, {
                uiSref: 'admin.index',
                name: 'Аккаунты в тестирующих системах'
            }*/];
        }
    ])

    .controller('AdminIndexController', ['$scope', '$rootScope', '$state', '_', 'ContestsManager', 'AdminManager', '$mdDialog',
        function ($scope, $rootScope, $state, _, ContestsManager, AdminManager, $mdDialog) {
            $scope.$emit('change_title', {
                title: 'Управление контестами | ' + _('app_name')
            });
            var defaultCount = 10;

            $scope.pageNumber = parseInt($state.params.pageNumber || 1);
            $scope.params = {
                count: defaultCount,
                offset: ($scope.pageNumber - 1) * defaultCount,
                category: 'all',
                sort: 'byId',
                sort_order: 'desc'
            };

            $scope.all_items_count = 0;
            $scope.pagination = [];
            $scope.contestsList = [];
            $scope.allPages = 0;

            $scope.curSortItem = null;
            $scope.sortCategories = [{
                name: 'По дате создания',
                sort: 'byId'
            }, {
                name: 'По времени завершения',
                sort: 'byEnd'
            }, {
                name: 'По времени начала',
                sort: 'byStart'
            }];

            $scope.curSortOrder = null;
            $scope.sortOrders = [{
                name: 'По убыванию',
                order: 'desc'
            }, {
                name: 'По возрастанию',
                order: 'asc'
            }];

            $scope.curCategory = null;
            $scope.contestCategories = [{
                name: 'Все',
                category: 'all'
            }, {
                name: 'Только активные',
                category: 'showOnlyStarted'
            }, {
                name: 'Только активные с заморозкой',
                category: 'showOnlyFrozen'
            }, {
                name: 'Только завершенные',
                category: 'showOnlyFinished'
            }, {
                name: 'Только дорешивание',
                category: 'showOnlyPractice'
            }, {
                name: 'Только доступные',
                category: 'showOnlyEnabled'
            }, {
                name: 'Только недоступные',
                category: 'showOnlyDisabled'
            }, {
                name: 'Только удалённые',
                category: 'showOnlyRemoved'
            }];

            function generatePaginationArray(offsetCount) {
                var pages = [],
                    curPage = $scope.pageNumber,
                    allItems = $scope.all_items_count,
                    backOffsetPages = offsetCount,
                    upOffsetPages = offsetCount,
                    allPages = Math.floor(allItems / defaultCount) +
                        (allItems && allItems % defaultCount ? 1 : 0);
                if (!defaultCount) {
                    allPages = 1e6;
                }
                $scope.allPages = allPages;
                for (var cur = Math.max(curPage - backOffsetPages, 1);
                     cur <= Math.min(curPage + upOffsetPages, allPages); ++cur) {
                    pages.push({
                        number: cur,
                        active: cur === curPage
                    });
                }
                return pages;
            }

            var firstInvokeStateChanged = true;
            $scope.$on('$stateChangeSuccess', function(event, toState, toParams, fromState, fromParams) {
                if (firstInvokeStateChanged) {
                    return firstInvokeStateChanged = false;
                }
                $scope.pageNumber = toParams.pageNumber ?
                    parseInt(toParams.pageNumber) : 1;
                $scope.params.offset = ($scope.pageNumber - 1) * defaultCount;
                updateContestsList();
            });

            function updateContestsList() {
                $rootScope.$broadcast('data loading');
                var contestsPromise = ContestsManager.getContests($scope.params);
                contestsPromise.then(function (result) {
                    $rootScope.$broadcast('data loaded');
                    if (!result || !result.hasOwnProperty('all_items_count')) {
                        return;
                    }
                    $scope.all_items_count = result.all_items_count;
                    $scope.contestsList = result.contests;
                    $scope.pagination = generatePaginationArray(5);
                }).catch(function (err) {
                    console.log(err);
                });
            }

            updateContestsList();

            $scope.$watch('curCategory', function (newVal, oldVal) {
                if (!newVal) {
                    return;
                }
                $scope.params.category = newVal;
                $scope.pageNumber !== 1 ?
                    $state.go('contests.list') : updateContestsList();
                console.log('updating contests list...');
            });

            $scope.$watch('curSortItem', function (newVal, oldVal) {
                if (!newVal) {
                    return;
                }
                $scope.params.sort = newVal;
                updateContestsList();
                console.log('updating contests list...');
            });

            $scope.$watch('curSortOrder', function (newVal, oldVal) {
                if (!newVal) {
                    return;
                }
                $scope.params.sort_order = newVal;
                updateContestsList();
                console.log('updating contests list...');
            });

            $scope.$on('admin update contest list', function () {
                updateContestsList();
            });
        }
    ])

    .controller('AdminEditContestController', ['$scope', '$rootScope', '$state', '_', 'AdminManager', '$mdDialog',
        function ($scope, $rootScope, $state, _, AdminManager, $mdDialog) {
            $scope.$emit('change_title', {
                title: 'Редактирование контеста | ' + _('app_name')
            });
            var contestId = $state.params.contestId;
            $scope.form = {};
            $scope.startTimes = [];
            $scope.startTimesMinutes = [];

            $scope.$watch('form.contestStartTime', function (newVal) {
                if (newVal > 1 && newVal < 4) {
                    var confirm = $mdDialog.confirm()
                        .title('Начало контеста будет ночью')
                        .content('Серьезно?')
                        .ariaLabel('Lucky day')
                        .ok('Да')
                        .cancel('Нет');

                    $mdDialog.show(confirm);
                }
            });

            var zF = function (num) { return num < 10 ? '0' + num : num };
            for (var i = 0; i < 24; ++i) {
                $scope.startTimes.push({
                    time: i,
                    name: zF(i)
                });
            }
            for (i = 0; i < 60; ++i) {
                $scope.startTimesMinutes.push({
                    time: i,
                    name: zF(i)
                });
            }

            $scope.chips = {
                selectedItem: '',
                searchText: ''
            };

            $scope.groupSearch = function (query) {
                return AdminManager.searchGroups({ q: query }).then(function (data) {
                    return data;
                });
            };

            $scope.systemType = 'all';
            $scope.problems = [];
            $scope.qProblems = '';
            $scope.systems = [{
                type: 'all',
                name: 'Все'
            }, {
                type: 'timus',
                name: 'Timus'
            }, {
                type: 'acmp',
                name: 'ACMP'
            }, {
                type: 'cf',
                name: 'Codeforces'
            }, {
                type: 'sgu',
                name: 'SGU'
            }];

            $scope.selectedProblems = [];

            var newQ = '';
            $scope.searchProblems = function () {
                newQ = $scope.qProblems;
                AdminManager.searchProblems({
                    q: $scope.qProblems,
                    type: $scope.systemType
                }).then(function (results) {
                    if (results.error) {
                        return alert('Произошла ошибка: ' + results.error);
                    }
                    if (newQ !== results.q) {
                        return console.log('Skipped result');
                    }
                    $scope.problems = results.items.map(function (problem) {
                        switch (problem.system_type) {
                            case 'cf':
                                var pTypeObj = problem.system_problem_number.split(':');
                                if (!pTypeObj || pTypeObj.length !== 2) {
                                    problem.task_number = problem.system_problem_number;
                                } else {
                                    problem.task_number = (pTypeObj[0] === 'gym' ? 'Тренировка' : 'Архив') +
                                        '. ' + pTypeObj[1];
                                }
                                break;
                            default: {
                                problem.task_number = problem.system_problem_number;
                            }
                        }
                        return problem;
                    });
                });
            };

            $scope.$watch('qProblems', function () {
                $scope.searchProblems();
            });

            $scope.$watch('systemType', function () {
                $scope.searchProblems();
            });

            $scope.existsProblem = function (problem, selectedProblems) {
                return selectedProblems.some(function (curProblem) {
                    return curProblem.id === problem.id;
                });
            };

            $scope.toggleProblem = function (problem, selectedProblems) {
                var exists = $scope.existsProblem(problem, selectedProblems);
                if (exists) {
                    selectedProblems.forEach(function (curProblem, index) {
                        if (curProblem.id === problem.id) {
                            selectedProblems.splice(index, 1);
                        }
                    });
                } else {
                    selectedProblems.push(problem);
                }
            };

            $scope.showProblem = function (ev, problem) {
                ev.stopPropagation();
                ev.preventDefault();
                ev.cancelBubble = true;

                $mdDialog.show({
                    controller: 'AdminProblemDialogController',
                    templateUrl: templateUrl('admin', 'admin-problem-dialog'),
                    targetEvent: ev,
                    clickOutsideToClose: true,
                    locals: {
                        problem: problem
                    }
                });
            };

            $scope.isShowingSelected = false;
            $scope.toggleSelected = function (ev) {
                $scope.isShowingSelected = !$scope.isShowingSelected;
                ev.stopPropagation();
                ev.preventDefault();
                ev.cancelBubble = true;
            };

            $scope.submitForm = function () {
                $rootScope.$broadcast('data loading');
                var form = angular.copy($scope.form);
                form.groups = (form.groups || []).map(function (group) {
                    return group.id;
                });
                var contestStartDate = form.contestStartDate;
                contestStartDate = {
                    year: contestStartDate.getFullYear(),
                    month: contestStartDate.getMonth(),
                    day: contestStartDate.getDate(),
                    hours: parseInt(form.contestStartTime),
                    minutes: parseInt(form.contestStartTimeMinutes)
                };
                form.contestStartTime = contestStartDate;
                delete form.contestStartDate;
                delete form.contestStartTimeMinutes;

                var problems = $scope.selectedProblems;
                form.problems = problems.map(function (problem) {
                    return problem.id;
                });

                form.contest_id = contestId;
                AdminManager.updateContest(form)
                    .then(function (result) {
                        $rootScope.$broadcast('data loaded');
                        if (!result || !result.result || result.error) {
                            return alert('Произошла ошибка');
                        }
                        $state.go('admin.index');
                    });
            };

            $scope.indexGenerator = function (curIndex) {
                var alphabet = 'abcdefghijklmnopqrstuvwxyz'.split(''),
                    symbolsNumber = Math.floor(curIndex / alphabet.length) + 1;
                if (symbolsNumber === 1) {
                    return alphabet[ curIndex ];
                } else {
                    return alphabet[ symbolsNumber - 2 ] + alphabet[ curIndex % alphabet.length ];
                }
            };

            $scope.objectRow = {};

            function getContestInfo() {
                $rootScope.$broadcast('data loading');
                AdminManager.getContestInfo({ contest_id: contestId })
                    .then(function (result) {
                        $rootScope.$broadcast('data loaded');
                        if (result.error) {
                            return alert('Произошла ошибка');
                        }
                        $scope.objectRow = result;
                        var startDate = new Date(result.startTime);
                        $scope.form = {
                            contestName: result.name,
                            contestStartDate: startDate,
                            contestRelativeFinishTime: result.relativeDurationTime / (1000 * 60 * 60),
                            contestFreezeTime: (result.relativeDurationTime - result.relativeFreezeTime) / (1000 * 60 * 60),
                            contestPracticeTime: result.relativePracticeTime / (1000 * 60 * 60),
                            contestStartTime: startDate.getHours(),
                            contestStartTimeMinutes: startDate.getMinutes(),
                            hasPractice: result.hasPracticeTime,
                            groups: result.allowedGroups || []
                        };
                        $scope.selectedProblems = result.problems.map(function (problem) {
                            switch (problem.system_type) {
                                case 'cf':
                                    var pTypeObj = problem.system_problem_number.split(':');
                                    if (!pTypeObj || pTypeObj.length !== 2) {
                                        problem.task_number = problem.system_problem_number;
                                    } else {
                                        problem.task_number = (pTypeObj[0] === 'gym' ? 'Тренировка' : 'Архив') +
                                            '. ' + pTypeObj[1];
                                    }
                                    break;
                                default: {
                                    problem.task_number = problem.system_problem_number;
                                }
                            }
                            return problem;
                        });
                    });
            }

            getContestInfo();
        }
    ])

    .controller('AdminCreateContestController', ['$scope', '$rootScope', '$state', '_', 'AdminManager', '$mdDialog',
        function ($scope, $rootScope, $state, _, AdminManager, $mdDialog) {
            $scope.$emit('change_title', {
                title: 'Создание контеста | ' + _('app_name')
            });
            $scope.form = {
                contestRelativeFinishTime: 5,
                contestFreezeTime: 1,
                contestPracticeTime: 0,
                contestStartTime: 9,
                contestStartTimeMinutes: 0,
                groups: []
            };
            $scope.startTimes = [];
            $scope.startTimesMinutes = [];

            $scope.$watch('form.contestStartTime', function (newVal) {
                if (newVal > 1 && newVal < 4) {
                    var confirm = $mdDialog.confirm()
                        .title('Начало контеста будет ночью')
                        .content('Серьезно?')
                        .ariaLabel('Lucky day')
                        .ok('Да')
                        .cancel('Нет');

                    $mdDialog.show(confirm);
                }
            });

            var zF = function (num) { return num < 10 ? '0' + num : num };
            for (var i = 0; i < 24; ++i) {
                $scope.startTimes.push({
                    time: i,
                    name: zF(i)
                });
            }
            for (i = 0; i < 60; ++i) {
                $scope.startTimesMinutes.push({
                    time: i,
                    name: zF(i)
                });
            }

            $scope.chips = {
                selectedItem: '',
                searchText: ''
            };

            $scope.groupSearch = function (query) {
                return AdminManager.searchGroups({ q: query }).then(function (data) {
                    return data;
                });
            };

            $scope.systemType = 'all';
            $scope.problems = [];
            $scope.qProblems = '';
            $scope.systems = [{
                type: 'all',
                name: 'Все'
            }, {
                type: 'timus',
                name: 'Timus'
            }, {
                type: 'acmp',
                name: 'ACMP'
            }, {
                type: 'cf',
                name: 'Codeforces'
            }, {
                type: 'sgu',
                name: 'SGU'
            }];

            $scope.selectedProblems = [];

            var newQ = '';
            $scope.searchProblems = function () {
                newQ = $scope.qProblems;
                AdminManager.searchProblems({
                    q: $scope.qProblems,
                    type: $scope.systemType
                }).then(function (results) {
                    if (results.error) {
                        return alert('Произошла ошибка: ' + results.error);
                    }
                    if (newQ !== results.q) {
                        return console.log('Skipped result');
                    }
                    $scope.problems = results.items.map(function (problem) {
                        switch (problem.system_type) {
                            case 'cf':
                                var pTypeObj = problem.system_problem_number.split(':');
                                if (!pTypeObj || pTypeObj.length !== 2) {
                                    problem.task_number = problem.system_problem_number;
                                } else {
                                    problem.task_number = (pTypeObj[0] === 'gym' ? 'Тренировка' : 'Архив') +
                                        '. ' + pTypeObj[1];
                                }
                                break;
                            default: {
                                problem.task_number = problem.system_problem_number;
                            }
                        }
                        return problem;
                    });
                });
            };

            $scope.$watch('qProblems', function () {
                $scope.searchProblems();
            });

            $scope.$watch('systemType', function () {
                $scope.searchProblems();
            });

            $scope.existsProblem = function (problem, selectedProblems) {
                return selectedProblems.some(function (curProblem) {
                    return curProblem.id === problem.id;
                });
            };

            $scope.toggleProblem = function (problem, selectedProblems) {
                var exists = $scope.existsProblem(problem, selectedProblems);
                if (exists) {
                    selectedProblems.forEach(function (curProblem, index) {
                        if (curProblem.id === problem.id) {
                            selectedProblems.splice(index, 1);
                        }
                    });
                } else {
                    selectedProblems.push(problem);
                }
            };

            $scope.showProblem = function (ev, problem) {
                ev.stopPropagation();
                ev.preventDefault();
                ev.cancelBubble = true;

                $mdDialog.show({
                    controller: 'AdminProblemDialogController',
                    templateUrl: templateUrl('admin', 'admin-problem-dialog'),
                    targetEvent: ev,
                    clickOutsideToClose: true,
                    locals: {
                        problem: problem
                    }
                });
            };

            $scope.isShowingSelected = false;
            $scope.toggleSelected = function (ev) {
                $scope.isShowingSelected = !$scope.isShowingSelected;
                ev.stopPropagation();
                ev.preventDefault();
                ev.cancelBubble = true;
            };

            $scope.submitForm = function () {
                $rootScope.$broadcast('data loading');
                var form = angular.copy($scope.form);
                form.groups = (form.groups || []).map(function (group) {
                    return group.id;
                });
                var contestStartDate = form.contestStartDate;
                contestStartDate = {
                    year: contestStartDate.getFullYear(),
                    month: contestStartDate.getMonth(),
                    day: contestStartDate.getDate(),
                    hours: parseInt(form.contestStartTime),
                    minutes: parseInt(form.contestStartTimeMinutes)
                };
                form.contestStartTime = contestStartDate;
                delete form.contestStartDate;
                delete form.contestStartTimeMinutes;

                var problems = $scope.selectedProblems;
                form.problems = problems.map(function (problem) {
                    return problem.id;
                });

                AdminManager.createContest(form)
                    .then(function (result) {
                        $rootScope.$broadcast('data loaded');
                        if (!result || !result.result || result.error) {
                            return alert('Произошла ошибка');
                        }
                        $state.go('admin.index');
                    });
            };

            $scope.indexGenerator = function (curIndex) {
                var alphabet = 'abcdefghijklmnopqrstuvwxyz'.split(''),
                    symbolsNumber = Math.floor(curIndex / alphabet.length) + 1;
                if (symbolsNumber === 1) {
                    return alphabet[ curIndex ];
                } else {
                    return alphabet[ symbolsNumber - 2 ] + alphabet[ curIndex % alphabet.length ];
                }
            };
        }
    ])

    .controller('AdminProblemDialogController', [
        '$scope', 'problem', '$mdDialog',
        function ($scope, problem, $mdDialog) {
            $scope.problem = problem;
            $scope.close = function () {
                $mdDialog.hide();
            };
        }
    ])

    .controller('AdminUsersListController', ['$scope', '$rootScope', '$state', '_', 'AdminManager', '$mdDialog',
        function ($scope, $rootScope, $state, _, AdminManager, $mdDialog) {
            $scope.$emit('change_title', {
                title: 'Список пользователей | ' + _('app_name')
            });

            var defaultCount = 10;

            $scope.pageNumber = parseInt($state.params.pageNumber || 1);
            $scope.params = {
                count: defaultCount,
                offset: ($scope.pageNumber - 1) * defaultCount
            };

            $scope.all_items_count = 0;
            $scope.pagination = [];
            $scope.usersList = [];
            $scope.allPages = 0;

            function generatePaginationArray(offsetCount) {
                var pages = [],
                    curPage = $scope.pageNumber,
                    allItems = $scope.all_items_count,
                    backOffsetPages = offsetCount,
                    upOffsetPages = offsetCount,
                    allPages = Math.floor(allItems / defaultCount) +
                        (allItems && allItems % defaultCount ? 1 : 0);
                if (!defaultCount) {
                    allPages = 1e6;
                }
                $scope.allPages = allPages;
                for (var cur = Math.max(curPage - backOffsetPages, 1);
                     cur <= Math.min(curPage + upOffsetPages, allPages); ++cur) {
                    pages.push({
                        number: cur,
                        active: cur === curPage
                    });
                }
                return pages;
            }

            var firstInvokeStateChanged = true;
            $scope.$on('$stateChangeSuccess', function(event, toState, toParams, fromState, fromParams) {
                if (firstInvokeStateChanged) {
                    return firstInvokeStateChanged = false;
                }
                $scope.pageNumber = toParams.pageNumber ?
                    parseInt(toParams.pageNumber) : 1;
                $scope.params.offset = ($scope.pageNumber - 1) * defaultCount;
                loadUsers();
            });

            $scope.$on('admin update users list', function () {
                loadUsers();
            });

            function loadUsers() {
                $rootScope.$broadcast('data loading');
                AdminManager.getUsers($scope.params)
                    .then(function (result) {
                        $rootScope.$broadcast('data loaded');
                        if (!result || !result.hasOwnProperty('all_items_count')) {
                            return;
                        }
                        $scope.all_items_count = result.all_items_count;
                        $scope.usersList = result.users;
                        $scope.pagination = generatePaginationArray(5);
                    }).catch(function (err) {
                        console.log(err);
                    });
            }
            loadUsers();
        }
    ])

    .controller('AdminCreateUserController', ['$scope', '$rootScope', '$state', '_', 'AdminManager', '$mdDialog', '$filter',
        function ($scope, $rootScope, $state, _, AdminManager, $mdDialog, $filter) {
            $scope.$emit('change_title', {
                title: 'Создание пользователя | ' + _('app_name')
            });
            
            $scope.form = {
                groups: []
            };

            $scope.chips = {
                selectedItem: '',
                searchText: ''
            };

            $scope.groupSearch = function (query) {
                return AdminManager.searchGroups({ q: query }).then(function (data) {
                    return data;
                });
            };

            $scope.submitForm = function () {
                $rootScope.$broadcast('data loading');
                var form = angular.copy($scope.form);
                form.groups = (form.groups || []).map(function (group) {
                    return group.id;
                });
                AdminManager.createUser(form)
                    .then(function (result) {
                        $rootScope.$broadcast('data loaded');
                        if (result.error) {
                            return alert('Произошла ошибка: ' + result.error);
                        }
                        $state.go('admin.users-list');
                    });
            };

            var fioChanged = function () {
                var firstName = $scope.form.firstName || '',
                    lastName = $scope.form.lastName || '',
                    username;
                if (!firstName && !lastName) {
                    $scope.form.username = '';
                    $scope.form.password = '';
                    return;
                } else if (!firstName) {
                    username = $filter('latinize')(lastName);
                } else if (!lastName) {
                    username = $filter('latinize')(firstName);
                } else {
                    username = $filter('latinize')(firstName[0]) + '.' + $filter('latinize')(lastName);
                }
                $scope.form.username = username;
                $scope.form.password = username;
            };

            $scope.$watch('form.firstName', fioChanged);
            $scope.$watch('form.lastName', fioChanged);
        }
    ])

    .controller('AdminEditUserController', ['$scope', '$rootScope', '$state', '_', 'AdminManager', '$mdDialog',
        function ($scope, $rootScope, $state, _, AdminManager, $mdDialog) {
            $scope.$emit('change_title', {
                title: 'Редактирование пользователя | ' + _('app_name')
            });
        }
    ])

    .controller('AdminUserListItemCtrl', ['$scope', '$rootScope', '$mdDialog', 'ContestsManager', '$state', 'AdminManager',
        function($scope, $rootScope, $mdDialog, ContestsManager, $state, AdminManager) {
            $scope.deleteUser = function () {
                var confirm = $mdDialog.confirm()
                    .title('Подтверждение')
                    .content('Вы действительно хотите удалить пользователя?')
                    .ariaLabel('Lucky day')
                    .ok('Да')
                    .cancel('Отмена');

                $mdDialog.show(confirm).then(function () {
                    $rootScope.$broadcast('data loading');
                    AdminManager.deleteUser({ user_id: $scope.user.id })
                        .then(function (result) {
                            $rootScope.$broadcast('data loaded');
                            if (result.error) {
                                return alert('Произошла ошибка: ' + result.error);
                            }
                            $scope.$emit('admin update users list');
                        });
                });
            };
        }
    ])

    .controller('AdminProblemsController', ['$scope', '$rootScope', '$mdDialog', '$state', 'AdminManager',
        function($scope, $rootScope, $mdDialog, $state, AdminManager) {
            $scope.loading = false;

            $scope.scan = function (systemType) {
                var confirm = $mdDialog.confirm()
                    .title('Подтверждение')
                    .content('Вы действительно хотите произвести сканирование? После этого желательно произвести перезагрузку сервера.')
                    .ariaLabel('Seriously?')
                    .ok('Да')
                    .cancel('Отмена');

                $mdDialog.show(confirm).then(function () {
                    var promise;
                    $scope.loading = true;
                    $scope.$emit('data loading');
                    switch (systemType) {
                        case 'timus':
                            promise = AdminManager.scanTimus();
                            break;
                        case 'cf:problemset':
                            promise = AdminManager.scanCfProblemset();
                            break;
                        case 'cf:gym':
                            promise = AdminManager.scanCfGym();
                            break;
                        case 'acmp':
                            promise = AdminManager.scanAcmp();
                            break;
                        default:
                            promise = AdminManager.scanTimus();
                    }
                    promise.then(function (data) {
                        $scope.loading = false;
                        $scope.$emit('data loaded');
                        if (data.error) {
                            return alert('Произошла ошибка: ' + data.error);
                        }
                        $scope.result = data;
                    });
                });
            };
        }
    ])

    .controller('AdminServerController', ['$scope', '$rootScope', '$mdDialog', '$state', 'AdminManager', '$timeout',
        function($scope, $rootScope, $mdDialog, $state, AdminManager, $timeout) {

            $scope.restart = function () {
                var confirm = $mdDialog.confirm()
                    .title('Подтверждение')
                    .content('Вы действительно хотите произвести рестарт системы? Перезапуск занимает от 1 до 2 секунд.')
                    .ariaLabel('Seriously?')
                    .ok('Да')
                    .cancel('Отмена');

                $mdDialog.show(confirm).then(function () {
                    $scope.loading = true;
                    $scope.$emit('data loading');

                    AdminManager.restart().then(function (data) {
                        $timeout(function () {
                            $scope.loading = false;
                        }, 2000);
                        $scope.$emit('data loaded');
                        if (data.error) {
                            return alert('Произошла ошибка: ' + data.error);
                        }
                    });
                });
            };
        }
    ])

    /* Base rating controller */
    .controller('AdminRatingBaseController', ['$scope', '$rootScope', '$state', 'AdminManager',
        function($scope, $rootScope, $state, AdminManager) {}
    ])

    /* Base create rating controller */
    .controller('AdminRatingCreateBaseController', ['$scope', '$rootScope', '$state', 'AdminManager', '_',
        function($scope, $rootScope, $state, AdminManager, _) {
            $scope.$emit('change_title', {
                title: 'Создание рейтинга | ' + _('app_name')
            });

            $scope.selectedContests = [];

            $scope.existsContest = function (contest, selectedContests) {
                return selectedContests.some(function (curItem) {
                    return curItem.id === contest.id;
                });
            };

            $scope.toggleContest = function (contest, selectedContests) {
                var exists = $scope.existsContest(contest, selectedContests);
                if (exists) {
                    selectedContests.forEach(function (curContest, index) {
                        if (curContest.id === contest.id) {
                            selectedContests.splice(index, 1);
                        }
                    });
                } else {
                    selectedContests.push(contest);
                }
            };

            $scope.createRating = function () {
                if (!$scope.selectedContests.length) {
                    return;
                }
                $state.go('admin-contests-rating-table', {
                    contests: $scope.selectedContests.map(function (contest) {
                        return contest.id;
                    }).join(',')
                });
            };
        }
    ])

    .controller('AdminRatingCreateController', ['$scope', '$rootScope', '$state', 'AdminManager', 'ContestsManager', '_',
        function($scope, $rootScope, $state, AdminManager, ContestsManager, _) {
            var defaultCount = 10;

            $scope.pageNumber = parseInt($state.params.pageNumber || 1);
            $scope.params = {
                count: defaultCount,
                offset: ($scope.pageNumber - 1) * defaultCount,
                category: 'all',
                sort: 'byId',
                sort_order: 'desc'
            };

            $scope.all_items_count = 0;
            $scope.pagination = [];
            $scope.contestsList = [];
            $scope.allPages = 0;

            $scope.curSortItem = null;
            $scope.sortCategories = [{
                name: 'По дате создания',
                sort: 'byId'
            }, {
                name: 'По времени завершения',
                sort: 'byEnd'
            }, {
                name: 'По времени начала',
                sort: 'byStart'
            }];

            $scope.curSortOrder = null;
            $scope.sortOrders = [{
                name: 'По убыванию',
                order: 'desc'
            }, {
                name: 'По возрастанию',
                order: 'asc'
            }];

            $scope.curCategory = null;
            $scope.contestCategories = [{
                name: 'Все',
                category: 'all'
            }, {
                name: 'Только активные',
                category: 'showOnlyStarted'
            }, {
                name: 'Только активные с заморозкой',
                category: 'showOnlyFrozen'
            }, {
                name: 'Только завершенные',
                category: 'showOnlyFinished'
            }, {
                name: 'Только дорешивание',
                category: 'showOnlyPractice'
            }, {
                name: 'Только доступные',
                category: 'showOnlyEnabled'
            }, {
                name: 'Только недоступные',
                category: 'showOnlyDisabled'
            }, {
                name: 'Только удалённые',
                category: 'showOnlyRemoved'
            }];

            function generatePaginationArray(offsetCount) {
                var pages = [],
                    curPage = $scope.pageNumber,
                    allItems = $scope.all_items_count,
                    backOffsetPages = offsetCount,
                    upOffsetPages = offsetCount,
                    allPages = Math.floor(allItems / defaultCount) +
                        (allItems && allItems % defaultCount ? 1 : 0);
                if (!defaultCount) {
                    allPages = 1e6;
                }
                $scope.allPages = allPages;
                for (var cur = Math.max(curPage - backOffsetPages, 1);
                     cur <= Math.min(curPage + upOffsetPages, allPages); ++cur) {
                    pages.push({
                        number: cur,
                        active: cur === curPage
                    });
                }
                return pages;
            }

            var firstInvokeStateChanged = true;
            $scope.$on('$stateChangeSuccess', function(event, toState, toParams, fromState, fromParams) {
                if (firstInvokeStateChanged) {
                    return firstInvokeStateChanged = false;
                }
                $scope.pageNumber = toParams.pageNumber ?
                    parseInt(toParams.pageNumber) : 1;
                $scope.params.offset = ($scope.pageNumber - 1) * defaultCount;
                updateContestsList();
            });

            function updateContestsList() {
                $rootScope.$broadcast('data loading');
                var contestsPromise = ContestsManager.getContests($scope.params);
                contestsPromise.then(function (result) {
                    $rootScope.$broadcast('data loaded');
                    if (!result || !result.hasOwnProperty('all_items_count')) {
                        return;
                    }
                    $scope.all_items_count = result.all_items_count;
                    $scope.contestsList = result.contests;
                    $scope.pagination = generatePaginationArray(5);
                }).catch(function (err) {
                    console.log(err);
                });
            }

            updateContestsList();

            $scope.$watch('curCategory', function (newVal, oldVal) {
                if (!newVal) {
                    return;
                }
                $scope.params.category = newVal;
                $scope.pageNumber !== 1 ?
                    $state.go('contests.list') : updateContestsList();
                console.log('updating contests list...');
            });

            $scope.$watch('curSortItem', function (newVal, oldVal) {
                if (!newVal) {
                    return;
                }
                $scope.params.sort = newVal;
                updateContestsList();
                console.log('updating contests list...');
            });

            $scope.$watch('curSortOrder', function (newVal, oldVal) {
                if (!newVal) {
                    return;
                }
                $scope.params.sort_order = newVal;
                updateContestsList();
                console.log('updating contests list...');
            });

            $scope.$on('admin update contest list', function () {
                updateContestsList();
            })
        }
    ])

    .controller('AdminRatingTableController', ['$scope', '$rootScope', '$state', 'AdminManager',
        function($scope, $rootScope, $state, AdminManager) {
            var contestIds = ( $state.params.contests || '' ).split( ',' ) || [ ];

            contestIds = contestIds.map(function (element) {
                return +element;
            }).filter(function (element) {
                return typeof element === 'number' && element > 0;
            });

            if (!contestIds.length) {
                return $state.go('admin.contests-rating.create.index');
            }

            $scope.scoreInTime = 2;
            $scope.scoreInPractice = 1;

            $scope.table = {};

            function updateRatingTable() {
                $rootScope.$broadcast('data loading');
                AdminManager.getRatingTable({
                    contests: contestIds,
                    score_in_time: $scope.scoreInTime,
                    score_in_practice: $scope.scoreInPractice
                }).then(function (result) {
                    $rootScope.$broadcast('data loaded');
                    if (!result || result.error) {
                        return alert('Произошла ошибка: ' + result.error);
                    }
                    $scope.table = result;
                });
            }
            $scope.updateRatingTable = updateRatingTable;
            updateRatingTable();
        }
    ])
;