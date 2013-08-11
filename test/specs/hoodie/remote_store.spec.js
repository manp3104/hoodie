'use strict';

describe("Hoodie.Remote", function() {

  beforeEach(function() {

    this.hoodie = new Mocks.Hoodie();

    this.sandbox.spy(this.hoodie, 'on');
    this.sandbox.spy(this.hoodie, 'trigger');
    this.sandbox.spy(this.hoodie, 'one');
    this.sandbox.spy(this.hoodie, 'unbind');
    this.sandbox.spy(this.hoodie, 'checkConnection');

    this.requestDefer = this.hoodie.defer();
    this.sandbox.stub(this.hoodie, 'request').returns(this.requestDefer.promise());

    this.storeApi = Mocks.StoreApi(this.hoodie);
    this.sandbox.stub(window, 'hoodieStoreApi').returns(this.storeApi);
    this.remote = hoodieRemoteStore(this.hoodie, { name: 'my/store'} );
    this.storeBackend = hoodieStoreApi.args[0][1].backend;
  });

  describe("factory", function() {
    it("should set @name from options", function() {
      expect(this.remote.name).to.eql('my/store');
    });

    it("should fallback prefix to ''", function() {
      expect(this.remote.prefix).to.eql('');
    });

    _when("prefix: $public passed", function() {
      beforeEach(function() {
        this.remote = hoodieRemoteStore(this.hoodie, {
          prefix: '$public'
        });
      });

      it("should set prefix accordingly", function() {
        expect(this.remote.prefix).to.eql('$public');
      });
    });

    _when("baseUrl: http://api.otherapp.com passed", function() {
      beforeEach(function() {
        this.remote = hoodieRemoteStore(this.hoodie, {
          baseUrl: 'http://api.otherapp.com'
        });
      });

      it("should set baseUrl accordingly", function() {
        expect(this.remote.baseUrl).to.eql('http://api.otherapp.com');
      });
    });
  }); // factory

  describe("#request(type, path, options)", function() {

    beforeEach(function() {
      delete this.remote.name;
    });

    it("should proxy to hoodie.request", function() {
      this.hoodie.request.returns('funk');
      var returnedValue = this.remote.request("GET", "/something");

      expect(this.hoodie.request).to.be.called();
      expect(returnedValue).to.eql('funk');
    });

    it("should set options.contentType to 'application/json'", function() {
      this.remote.request("GET", "/something");
      expect(this.hoodie.request).to.be.calledWith("GET", "/something", {
        contentType: 'application/json'
      });
    });

    it("should prefix path with @name (encoded)", function() {
      this.remote.name = "my/funky/store";
      this.remote.request("GET", "/something");
      var typeAndPath = this.hoodie.request.args[0];

      expect(typeAndPath[1]).to.eql('/my%2Ffunky%2Fstore/something');
    });

    it("should prefix path with @baseUrl", function() {
      var path, type;
      this.remote.baseUrl = 'http://api.otherapp.com';
      this.remote.request("GET", "/something");

      var typeAndPath = this.hoodie.request.args[0];

      expect(typeAndPath[1]).to.eql('http://api.otherapp.com/something');
    });

    _when("type is POST", function() {

      beforeEach(function() {
        var path, type;
        this.remote.request("POST", "/something");
        var args = this.hoodie.request.args[0];

        type = args[0];
        path = args[1];
        this.options = args[2];
      });

      it("should default options.dataType to 'json'", function() {
        expect(this.options.dataType).to.eql('json');
      });

      it("should default options.dataType to 'json'", function() {
        expect(this.options.processData).to.eql(false);
      });

    });
  }); // #request

  describe("#find(type, id)", function() {

    it("should send a GET request to `/type%2Fid`", function() {
      var path, type;
      this.storeBackend.find('car', '123');
      var _ref = this.hoodie.request.args[0];
      type = _ref[0],
      path = _ref[1];

      expect(type).to.eql('GET');
      expect(path).to.eql('/my%2Fstore/car%2F123');
    });

    _when("prefix is store_prefix/", function() {

      beforeEach(function() {
        this.remote.prefix = 'store_prefix/';
      });

      it("should send request to `store_prefix%2Ftype%2Fid`", function() {
        var path, type;
        this.storeBackend.find('car', '123');
        var _ref = this.hoodie.request.args[0];

        type = _ref[0],
        path = _ref[1];

        expect(type).to.eql('GET');
        expect(path).to.eql('/my%2Fstore/store_prefix%2Fcar%2F123');
      });

      _and("request successful", function() {

        beforeEach(function() {
          this.requestDefer.resolve({
            _id: 'store_prefix/car/fresh',
            createdAt: '2012-12-12T22:00:00.000Z',
            updatedAt: '2012-12-21T22:00:00.000Z'
          });
        });

        it("should resolve with the doc", function() {

          this.storeBackend.find('todo', '1').then(function (res) {
            expect(res).to.eql({
              id: 'fresh',
              type: 'car',
              createdAt: '2012-12-12T22:00:00.000Z',
              updatedAt: '2012-12-21T22:00:00.000Z'
            });
          });

        });

      });

    });
  });

  describe("#findAll(type)", function() {

    it("should return a promise", function() {
      expect(this.storeBackend.findAll()).to.promise();
    });

    _when("type is not set", function() {

      _and("prefix is empty", function() {

        beforeEach(function() {
          this.remote.prefix = '';
        });

        it("should send a GET to /_all_docs?include_docs=true", function() {
          this.storeBackend.findAll();
          expect(this.hoodie.request).to.be.calledWith("GET", "/my%2Fstore/_all_docs?include_docs=true", { "contentType": "application/json" });
        });

      });

      _and("prefix is '$public'", function() {

        beforeEach(function() {
          this.remote.prefix = '$public/';
        });

        it("should send a GET to /_all_docs?include_docs=true&startkey=\"$public/\"&endkey=\"$public0\"", function() {
          this.storeBackend.findAll();
          expect(this.hoodie.request).to.be.calledWith("GET", '/my%2Fstore/_all_docs?include_docs=true&startkey="%24public%2F"&endkey="%24public0"', { "contentType": "application/json" });
        });

      });

    });

    _when("type is todo", function() {

      it('should send a GET to /_all_docs?include_docs=true&startkey="todo/"&endkey="todo0"', function() {
        this.storeBackend.findAll('todo');
        expect(this.hoodie.request).to.be.calledWith("GET", '/my%2Fstore/_all_docs?include_docs=true&startkey="todo%2F"&endkey="todo0"', { "contentType": "application/json" });
      });

      _and("prefix is 'remote_prefix'", function() {

        beforeEach(function() {
          this.remote.prefix = 'remote_prefix/';
        });

        it('should send a GET to /_all_docs?include_docs=true&startkey="remote_prefix%2Ftodo%2F"&endkey="remote_prefix%2Ftodo0"', function() {
          this.storeBackend.findAll('todo');
          expect(this.hoodie.request).to.be.calledWith("GET", '/my%2Fstore/_all_docs?include_docs=true&startkey="remote_prefix%2Ftodo%2F"&endkey="remote_prefix%2Ftodo0"', { "contentType": "application/json" });
        });

      });

    });

    _when("request success", function() {

      beforeEach(function() {
        this.doc = {
          _id: 'car/fresh',
          createdAt: '2012-12-12T22:00:00.000Z',
          updatedAt: '2012-12-21T22:00:00.000Z'
        };
        this.requestDefer.resolve({
          total_rows: 3,
          offset: 0,
          rows: [
            {
              doc: this.doc
            }
          ]
        });
      });

      it("should be resolved with array of objects", function() {
        var object = {
          id: 'fresh',
          type: 'car',
          createdAt: '2012-12-12T22:00:00.000Z',
          updatedAt: '2012-12-21T22:00:00.000Z'
        };
        this.storeBackend.findAll().then(function (res) {
          expect(res).to.eql([object]);
        });
      });

    });

    _when("request has an error", function() {

      beforeEach(function() {
        this.requestDefer.reject("error");
      });

      it("should be rejected with the response error", function() {
        var promise = this.storeBackend.findAll();
        promise.fail(function (res) {
          expect(res).to.eql("error");
        });
      });

    });
  });

  describe("#save(type, id, object)", function() {

    beforeEach(function() {
      this.sandbox.stub(this.hoodie, "uuid").returns("uuid567");
    });

    it("should generate an id if it is undefined", function() {
      this.storeBackend.save({type: 'car'});
      expect(this.hoodie.uuid).to.be.called();
    });

    it("should not generate an id if id is set", function() {
      this.storeBackend.save({type: 'car', id: '123'});
      expect(this.hoodie.uuid).to.not.be.called();
    });

    it("should return promise by @request", function() {
      this.hoodie.request.returns('request_promise');
      expect(this.storeBackend.save("car", 123, {})).to.eql('request_promise');
    });

    _when("saving car/123 with color: red", function() {

      beforeEach(function() {
        var _ref1;
        this.storeBackend.save({
          type: 'car',
          id: '123',
          color: "red"
        });

        var args = this.hoodie.request.args[0];
        this.type = args[0];
        this.path = args[1];
        this.data = JSON.parse(args[2].data);
      });

      it("should send a PUT request to `/my%2Fstore/car%2F123`", function() {
        expect(this.type).to.eql('PUT');
        expect(this.path).to.eql('/my%2Fstore/car%2F123');
      });

      it("should add type to saved object", function() {
        expect(this.data.type).to.eql('car');
      });

      it("should set _id to `car/123`", function() {
        expect(this.data._id).to.eql('car/123');
      });

      it("should not generate a _rev", function() {
        expect(this.data._rev).to.be(undefined);
      });

    });

    _when("saving car/123 with color: red and prefix is 'remote_prefix'", function() {
      beforeEach(function() {

        this.remote.prefix = 'remote_prefix/';
        this.storeBackend.save({
          type: 'car',
          id: '123',
          color: "red"
        });

        var args = this.hoodie.request.args[0];
        this.type = args[0];
        this.path = args[1];
        this.data = JSON.parse(args[2].data);
      });

      it("should send a PUT request to `/my%2Fstore/remote_prefix%2Fcar%2F123`", function() {
        expect(this.type).to.eql('PUT');
        expect(this.path).to.eql('/my%2Fstore/remote_prefix%2Fcar%2F123');
      });

      it.only("should set _id to `remote_prefix/car/123`", function() {
        expect(this.data._id).to.eql('remote_prefix/car/123');
      });

    });

  });

  describe("#remove(type, id)", function() {

    beforeEach(function() {
      this.sandbox.stub(this.remote, "update").returns("update_promise");
    });

    it("should proxy to update with _deleted: true", function() {
      this.remote.remove('car', 123);

      expect(this.remote.update.calledWith('car', 123, {
        _deleted: true
      })).to.be.ok();
    });

    it("should return promise of update", function() {
      expect(this.remote.remove('car', 123)).to.eql('update_promise');
    });

  });

  describe("#removeAll(type)", function() {

    beforeEach(function() {
      this.sandbox.stub(this.remote, "updateAll").returns("updateAll_promise");
    });

    it("should proxy to updateAll with _deleted: true", function() {
      this.remote.removeAll('car');
      expect(this.remote.updateAll.calledWith('car', {
        _deleted: true
      })).to.be.ok();
    });

    it("should return promise of updateAll", function() {
      expect(this.remote.removeAll('car')).to.eql('updateAll_promise');
    });

  });

  describe("#connect()", function() {

    beforeEach(function() {
      this.sandbox.spy(this.remote, "bootstrap");
    });

    it("should set connected to true", function() {
      this.remote.connected = false;
      this.remote.connect();
      expect(this.remote.connected).to.eql(true);
    });

    it("should bootstrap", function() {
      this.remote.connect();
      expect(this.remote.bootstrap.called).to.be.ok();
    });

  });

  describe("#disconnect()", function() {

    //it("should not fail when there are no running requests", function() {
      //this.remote._pullRequest = undefined
      //this.remote._pushRequest = undefined
      //expect( this.remote.disconnect ).not.toThrow()
    //});

    it("should abort the pull request", function() {
      this.remote._pullRequest = {
        abort: this.sandbox.spy()
      };
      this.remote.disconnect();
      expect(this.remote._pullRequest.abort.called).to.be.ok();
    });

    it("should abort the push request", function() {
      this.remote._pushRequest = {
        abort: this.sandbox.spy()
      };
      this.remote.disconnect();
      expect(this.remote._pushRequest.abort.called).to.be.ok();
    });

  });

  describe("#getSinceNr()", function() {

    _when("since not set before", function() {

      it("should return 0", function() {
        expect(this.remote._since).to.eql(void 0);
        expect(this.remote.getSinceNr()).to.eql(0);
      });

    });

    _when("since set to 100 before", function() {

      beforeEach(function() {
        this.remote.setSinceNr(100);
      });

      it("should return 100", function() {
        expect(this.remote.getSinceNr()).to.eql(100);
      });

    });

  });

  describe("#setSinceNr(since)", function() {
    it("should set _since property", function() {
      expect(this.remote._since).to.eql(void 0);
      this.remote.setSinceNr(100);
      expect(this.remote._since).to.eql(100);
    });
  });

  describe("#bootstrap()", function() {

    beforeEach(function() {
      this.bootstrapDefer = this.hoodie.defer();
      this.sandbox.stub(this.remote, "pull").returns( this.bootstrapDefer );
      this.sandbox.spy(this.remote, "trigger");
    });

    it("should trigger bootstrap:start event", function() {
      this.remote.bootstrap()
      expect(this.remote.trigger.calledWith('bootstrap:start')).to.be.ok();
    });

    it("should pull", function() {
      this.remote.bootstrap()
      expect(this.remote.pull.called).to.be.ok();
    });

    _when("bootstrap succeeds", function() {

      beforeEach(function() {
        this.bootstrapDefer.resolve()
      });

      it("should trigger 'bootstrap:end' event", function() {
        this.remote.bootstrap()
        expect(this.remote.trigger.calledWith('bootstrap:end')).to.be.ok();
      });

    });

  });

  describe("#pull()", function() {

    beforeEach(function() {
      this.remote.connected = true;
      this.object1 = {
        type: 'todo',
        id: 'abc3',
        _rev: '2-123',
        _deleted: true
      };
      this.object2 = {
        type: 'todo',
        id: 'abc2',
        _rev: '1-123',
        content: 'remember the milk',
        done: false,
        order: 1
      };
      this.object3 = {
        type: 'todo',
        id: 'abc4',
        _rev: '4-123',
        content: 'I am prefixed yo.',
        done: false,
        order: 2
      };
      this.object4 = {
        id: "abc5",
        type: "todo",
        _rev: "5-123",
        content: "deleted, but unknown",
        _deleted: true
      };
    });

    _when(".isConnected() is true", function() {

      beforeEach(function() {
        this.sandbox.stub(this.remote, "isConnected").returns(true);
      });

      it("should send a longpoll GET request to the _changes feed", function() {
        var method, path, _ref;
        this.remote.pull();
        expect(this.hoodie.request.called).to.be.ok();

        _ref = this.hoodie.request.args[0], method = _ref[0], path = _ref[1];
        expect(method).to.eql('GET');
        expect(path).to.eql('/_changes?include_docs=true&since=0&heartbeat=10000&feed=longpoll');
      });

      it("should set a timeout to restart the pull request", function() {
        this.remote.pull();
        expect(window.setTimeout.calledWith(this.remote._restartPullRequest, 25000)).to.be.ok();
      });

    });

    _when(".isConnected() is false", function() {

      beforeEach(function() {
        this.sandbox.stub(this.remote, "isConnected").returns(false);
      });

      it("should send a normal GET request to the _changes feed", function() {
        var method, path, _ref;
        this.remote.pull();
        expect(this.hoodie.request.called).to.be.ok();
        _ref = this.hoodie.request.args[0], method = _ref[0], path = _ref[1];
        expect(method).to.eql('GET');
        expect(path).to.eql('/_changes?include_docs=true&since=0');
      });

    });

    _when("request is successful / returns changes", function() {

      beforeEach(function() {
        var _this = this;
        this.hoodie.request.returns({
          then: function(success) {
            _this.hoodie.request.returns({
              then: function() {}
            });
            success(Mocks.changesResponse());
          }
        });
      });

      xit("should trigger remote events", function() {
        this.sandbox.spy(this.remote, "trigger");
        this.sandbox.spy(this.remote, "isKnownObject").returns(function(object) {
          return object.id === 'abc3';
        });

        this.remote.pull();

        expect(this.remote.trigger.calledWith('remove', this.object1)).to.be.ok();
        expect(this.remote.trigger.calledWith('remove:todo', this.object1)).to.be.ok();
        expect(this.remote.trigger.calledWith('remove:todo:abc3', this.object1)).to.be.ok();
        expect(this.remote.trigger.calledWith('change', 'remove', this.object1)).to.be.ok();
        expect(this.remote.trigger.calledWith('change:todo', 'remove', this.object1)).to.be.ok();
        expect(this.remote.trigger.calledWith('change:todo:abc3', 'remove', this.object1)).to.be.ok();
        expect(this.remote.trigger.calledWith('add', this.object2)).to.be.ok();
        expect(this.remote.trigger.calledWith('add:todo', this.object2)).to.be.ok();
        expect(this.remote.trigger.calledWith('add:todo:abc2', this.object2)).to.be.ok();
        expect(this.remote.trigger.calledWith('change', 'add', this.object2)).to.be.ok();
        expect(this.remote.trigger.calledWith('change:todo', 'add', this.object2)).to.be.ok();
        expect(this.remote.trigger.calledWith('change:todo:abc2', 'add', this.object2)).to.be.ok();
        expect(this.remote.trigger.calledWith('remove:todo:abc5', this.object4)).to.not.be.ok();
      });

      _and(".isConnected() returns true", function() {

        beforeEach(function() {
          this.sandbox.stub(this.remote, "isConnected").returns(true);
          this.sandbox.stub(this.remote, "pull");
        });

        xit("should pull again", function() {
          this.remote.pull();
          expect(this.remote.pull.callCount).to.eql(2);
        });

      });

      _and("prefix is set", function() {

        beforeEach(function() {
          this.remote.prefix = 'prefix/';
        });

        it("should trigger events only for objects with prefix", function() {
          this.sandbox.spy(this.remote, "trigger");
          this.remote.pull();
          expect(this.remote.trigger.calledWith('add', this.object3)).to.be.ok();
          expect(this.remote.trigger.calledWith('add', this.object2)).to.not.be.ok();
        });

      });

      _and("object has been returned before", function() {

        beforeEach(function() {
          this.sandbox.stub(this.remote, "isKnownObject").returns(true);
          this.sandbox.spy(this.remote, "trigger");
          this.remote.pull();
        });

        it("should trigger update events", function() {
          var object = {
            'type': 'todo',
            id: 'abc2',
            _rev: '1-123',
            content: 'remember the milk',
            done: false,
            order: 1
          };
          expect(this.remote.trigger.calledWith('update', object)).to.be.ok();
        });

      });

    });

    _when("request errors with 401 unauthorzied", function() {

      beforeEach(function() {
        var _this = this;
        this.hoodie.request.returns({
          then: function() {
            _this.hoodie.request.returns({
              then: function() {}
            });
          }
        });

        this.sandbox.spy(this.remote, "disconnect");
      });

      it("should disconnect", function() {
        this.remote.pull();
        expect(this.remote.disconnect.called).to.be.ok();
      });

      it("should trigger an unauthenticated error", function() {
        this.sandbox.spy(this.remote, "trigger");
        this.remote.pull();
        expect(this.remote.trigger.calledWith('error:unauthenticated', 'error object')).to.be.ok();
      });

    });

    _when("request errors with 404 not found", function() {

      beforeEach(function() {
        var _this = this;
        this.hoodie.request.returns({
          then: function(success, error) {
            _this.hoodie.request.returns({
              then: function() {}
            });
            error({
              status: 404
            }, 'error object');
          }
        });
      });

      it("should try again in 3 seconds (it migh be due to a sign up, the userDB might be created yet)", function() {
        this.remote.pull();
        expect(window.setTimeout.calledWith(this.remote.pull, 3000)).to.be.ok();
      });

    });

    _when("request errors with 500 oooops", function() {

      beforeEach(function() {
        var _this = this;
        this.hoodie.request.returns({
          then: function(success, error) {
            _this.hoodie.request.returns({
              then: function() {}
            });
            error({
              status: 500
            }, 'error object');
          }
        });
      });

      it("should try again in 3 seconds (and hope it was only a hiccup ...)", function() {
        this.remote.pull();
        expect(window.setTimeout.calledWith(this.remote.pull, 3000)).to.be.ok();
      });

      it("should trigger a server error event", function() {
        this.sandbox.spy(this.remote, "trigger");
        this.remote.pull();
        expect(this.remote.trigger.calledWith('error:server', 'error object')).to.be.ok();
      });

      it("should check connection", function() {
        this.remote.pull();
        expect(this.hoodie.checkConnection.called).to.be.ok();
      });

    });

    _when("request was aborted manually", function() {

      beforeEach(function() {
        var _this = this;
        this.hoodie.request.returns({
          then: function(success, error) {
            _this.hoodie.request.returns({
              then: function() {}
            });
            error({
              statusText: 'abort'
            }, 'error object');
          }
        });

        this.sandbox.stub(this.remote, "pull");
      });

      _and("is connected", function() {

        beforeEach(function() {
          this.sandbox.stub(this.remote, "isConnected").returns(true);
        });

        it("should pull again", function() {
          this.remote.pull();
          expect(this.remote.pull.callCount).to.eql(2);
        });

      });

      _and("is not connected", function() {

        beforeEach(function() {
          this.sandbox.stub(this.remote, "isConnected").returns(false);
        });

        it("should not pull again", function() {
          this.remote.pull();
          expect(this.remote.pull.callCount).to.eql(1);
        });

      });

    });

    _when("there is a different error", function() {

      beforeEach(function() {
        var _this = this;
        this.hoodie.request.returns({
          then: function(success, error) {
            _this.hoodie.request.returns({
              then: function() {}
            });
            error({}, 'error object');
          }
        });

      });

      it("should try again in 3 seconds if .isConnected() returns false", function() {

        this.sandbox.stub(this.remote, "isConnected").returns(true);

        this.remote.pull();

        expect(window.setTimeout.calledWith(this.remote.pull, 3000)).to.be.ok();
        window.setTimeout.reset();
        this.remote.isConnected.returns(false);
        this.remote.pull();

        expect(window.setTimeout.calledWith(this.remote.pull, 3000)).to.not.be.ok();
      });

      it("should check connection", function() {
        this.remote.pull();
        expect(this.hoodie.checkConnection.called).to.be.ok();
      });

    });

  });

  describe("#push(docs)", function() {

    beforeEach(function() {
      this.sandbox.stub(Date, "now").returns(10);
      this.remote._timezoneOffset = 1;
    });

    _when("no docs passed", function() {

      it("shouldn't do anything", function() {
        this.remote.push();
        this.remote.push([]);

        expect(this.hoodie.request.called).to.not.be.ok();
      });

    });

    _and("Array of docs passed", function() {

      beforeEach(function() {
        this.todoObjects = [
          {
            type: 'todo',
            id: '1'
          }, {
            type: 'todo',
            id: '2'
          }, {
            type: 'todo',
            id: '3'
          }
        ];
        this.promise = this.remote.push(this.todoObjects);
      });

      it("should return a promise", function() {
        expect(this.promise).to.have.property('done');
        expect(this.promise).to.not.have.property('resolved');
      });

      it("should POST the passed objects", function() {
        expect(this.hoodie.request.called).to.be.ok();
        var data = this.hoodie.request.args[2].data;
        expect(data.docs.length).to.eql(3);
      });

    });

    _and("one deleted and one new doc passed", function() {

      beforeEach(function() {
        this.remote.push(Mocks.changedObjects());
        expect(this.hoodie.request.called).to.be.ok();
        var _ref = this.hoodie.request.args[0];

        this.method = _ref[0],
        this.path = _ref[1],
        this.options = _ref[2];
      });

      it("should post the changes to the user's db _bulk_docs API", function() {
        expect(this.method).to.eql('POST');
        expect(this.path).to.eql('/_bulk_docs');
      });

      it("should send the docs in appropriate format", function() {
        var doc, docs;
        docs = this.options.data.docs;
        doc = docs[0];
        expect(doc.id).to.eqlUndefined();
        expect(doc._id).to.eql('todo/abc3');
        expect(doc._localInfo).to.be(undefined);
      });

      it("should set data.new_edits to false", function() {
        var new_edits;
        new_edits = this.options.data.new_edits;
        expect(new_edits).to.eql(false);
      });

      it("should set new _revision ids", function() {
        var deletedDoc, docs, newDoc;
        docs = this.options.data.docs;
        deletedDoc = docs[0], newDoc = docs[1];
        expect(deletedDoc._rev).to.eql('3-uuid');
        expect(newDoc._rev).to.match('1-uuid');
        expect(deletedDoc._revisions.start).to.eql(3);
        expect(deletedDoc._revisions.ids[0]).to.eql('uuid');
        expect(deletedDoc._revisions.ids[1]).to.eql('123');
        expect(newDoc._revisions.start).to.eql(1);
        expect(newDoc._revisions.ids[0]).to.eql('uuid');
      });

    });

    _and("prefix set to $public", function() {

      beforeEach(function() {
        this.remote.prefix = '$public/';
        this.todoObjects = [
          {
            type: 'todo',
            id: '1'
          }, {
            type: 'todo',
            id: '2'
          }, {
            type: 'todo',
            id: '3'
          }
        ];
        this.remote.push(this.todoObjects);
      });

      xit("should prefix all document IDs with '$public/'", function() {
        expect(this.hoodie.request.called).to.be.ok();

        var data = this.hoodie.request.args[2].data;
        expect(data.docs[0]._id).to.eql('$public/todo/1');
      });

    });

    _and("_$local flags set", function() {

      beforeEach(function() {
        this.remote.prefix = '$public/';
        this.todoObjects = [
          {
            type: 'todo',
            id: '1'
          }, {
            type: 'todo',
            id: '2',
            _$local: true
          }
        ];
        this.remote.push(this.todoObjects);
      });

      it("should add `-local` suffix to rev number", function() {
        expect(this.hoodie.request).wasCalled();
        var data = this.hoodie.request.args[2].data;
        expect(data.docs[0]._rev).to.eql('1-uuid');
        expect(data.docs[1]._rev).to.eql('1-uuid-local');
      });

    });

  });

  describe("#sync(docs)", function() {

    beforeEach(function() {
      this.sandbox.stub(this.remote, "push").returns(function(docs) {
        return {
          pipe: function(cb) {
            cb(docs);
          }
        };
      });

      this.sandbox.spy(this.remote, "pull");
    });

    it("should push changes and pass arguments", function() {
      this.remote.sync([1, 2, 3]);
      expect(this.remote.push.calledWith([1, 2, 3])).to.be.ok();
    });

    it("should pull changes and pass arguments", function() {
      this.remote.sync([1, 2, 3]);
      expect(this.remote.pull.calledWith([1, 2, 3])).to.be.ok();
    });

  });

  describe("#on(event, callback)", function() {

    it("should namespace events with `name`", function() {
      var cb = this.save.spy();
      this.remote.name = 'databaseName';
      this.remote.on('funky', cb);

      expect(this.hoodie.on.calledWith('databaseName:funky', cb)).to.be.ok();
    });

    it("should namespace multiple events correctly", function() {
      var cb = this.sandbox.spy();
      this.remote.name = 'databaseName';
      this.remote.on('super funky fresh', cb);
      expect(this.hoodie.on.calledWith('databaseName:super databaseName:funky databaseName:fresh', cb)).to.be.ok();
    });

  });

  describe("#trigger(event, parameters...)", function() {

    it("should namespace events with `name`", function() {
      var cb = this.sandbox.spy();
      this.remote.name = 'databaseName';
      this.remote.trigger('funky', cb);
      expect(this.hoodie.trigger.calledWith('databaseName:funky', cb)).to.be.ok();
    });

  });

});
