define(["./colorator", "./sequence", "./ordering", "./menu", "./utils", "./labelcolorator", "./row", "cs!./highlightor", "cs!msa/eventhandler"], function(Colorator, Sequence, Ordering, Menu, Utils, LabelColorator, Row, Highlightor, Eventhandler) {
  return function msa(divName, config){

    var _self = this;
    // support for only one argument
    if( typeof config === "undefined"){
      config = {}
    }

    this.columnWidth = 20;
    this.columnHeight = 20;
    this.columnSpacing = 5;
    // how much space for the labels?
    this.seqOffset = 140;

    this.colorscheme = new Colorator(); 
    this.labelColorScheme = new LabelColorator();
    this.ordering = new Ordering();
    this.highlightor = new Highlightor(this);

    this.visibleElements = {
      labels: true, sequences: true, menubar: true, ruler: true};


    // an Array of BioJS.MSA.Row
    this.seqs = [];


    // create menubar  + canvas
    this.console = document.getElementById("console");
    this.container = document.getElementById(divName);

    // BEGIN : CONSTRUCTOR
    if ( typeof config.registerMoveOvers !== "undefined"){
      this.registerMoveOvers = true;
      this.container.addEventListener('mouseout',function(evt){
        _self._cleanupSelections();
      });
    }else{
      this.registerMoveOvers = false;
    }

    this.stageID =  String.fromCharCode(65 + Math.floor(Math.random() * 26));
    this.globalID = 'biojs_msa_' + this.stageID;

    this.menu = new Menu(this);
    this.stage= document.createElement("div");
    this.stage.setAttribute("id",this.globalID+"_canvas"); 
    this.stage.setAttribute("class", "biojs_msa_stage");
    this.container.appendChild(this.menu.menu);
    this.container.appendChild(this.stage);

    this._seqMarkerLayer = document.createElement("div");
    this._seqMarkerLayer.className = "biojs_msa_marker";
    this.stage.appendChild(this._seqMarkerLayer);

    this.stage.style.cursor = "default";

    // END : CONSTRUCTOR

    this.addDummySequences = function(){
      // define seqs
      var seqs = [new Sequence("MSPFTACAPDRLNAGECTF", "awesome name", 1)
        ,new Sequence("QQTSPLQQQDILDMTVYCD", "awesome name2", 2)
        ,new Sequence("FTQHGMSGHEISPPSEPGH", "awesome name3", 3)];

      this.addSequences(seqs);
    };

    this._addSequence = function(tSeq){

      var layer = document.createElement("div");

      if(this.visibleElements.labels === true){
        layer.appendChild(this._createLabel(tSeq));
      }

      if(this.visibleElements.sequences === true){
        layer.appendChild(this._createSeqRow(tSeq)); 
      }

      layer.className = "biojs_msa_layer";

      // append to DOM
      this.stage.appendChild(layer);

      // save and add the layer
      this.seqs[tSeq.id] = new Row(tSeq,layer);

      //order the stuff ?
    };

    this.addSequence = function(tSeq){
      this.addSequence(tSeq);
      this.orderSeqsAfterScheme();
    };

    this.addSequences= function (tSeqs){

      for(var i=0;i<tSeqs.length;i++){
        this._addSequence(tSeqs[i]);
      }

      this.orderSeqsAfterScheme();
    };

    /* 
     * creates all amino acids
     */
    this._createSeqRow = function(tSeq){

      var residueGroup = document.createDocumentFragment();

      for(var n = 0; n < tSeq.seq.length; n++) {
        var residueSpan = document.createElement("span");
        residueSpan.style.width = this.columnWidth + "px";
        residueSpan.textContent = tSeq.seq[n];
        residueSpan.rowPos = n;

        residueSpan.addEventListener('click',function(evt){

          var id = this.parentNode.seqid;
          _self.highlightor.selectResidue(id,this.rowPos);
          // send event
          _self.events.onPositionClicked(id,this.rowPos);
        }, false);


        if( this.registerMoveOvers === true){
          residueSpan.addEventListener('mouseover',function(evt){
            var id = this.parentNode.seqid;
            _self.highlightor.selectResidue(id,this.rowPos);
            _self.events.onPositionClicked(id,this.rowPos);
          }, false);
        }


        // color it nicely
        this.colorscheme.colorResidue(residueSpan, tSeq, n);
        residueGroup.appendChild(residueSpan);
      }

      var residueSpan = document.createElement("span");
      residueSpan.seqid = tSeq.id;
      residueSpan.className = "biojs_msa_sequence_block";
      residueSpan.appendChild(residueGroup);
      return residueSpan;
    };

    this._drawSeqMarker = function(nMax){

      // using fragments is the fastest way
      // try to minimize DOM updates as much as possible
      // http://jsperf.com/innerhtml-vs-createelement-test/6
      var residueGroup = document.createDocumentFragment();

      for(var n = 0; n < nMax; n++) {
        var residueSpan = document.createElement("span");

        residueSpan.textContent = n;
        residueSpan.style.width = this.columnWidth + "px";
        residueSpan.style.display = "inline-block";
        residueSpan.rowPos = n;

        residueSpan.addEventListener('click',function(evt){
          _self.highlightor.selectColumn(this.rowPos);
          _self.events.onColumnSelect(this.rowPos);
        }, false);

        if( this.registerMoveOvers === true){
          residueSpan.addEventListener('mouseover',function(evt){
            _self.highlightor.selectColumn(this.rowPos);
            _self.events.onColumnSelect(this.rowPos);
          }, false);
        }

        // color it nicely
        this.colorscheme.colorColumn(residueSpan, n);
        residueGroup.appendChild(residueSpan);
      }
      return residueGroup;
    };


    /*
     * creates the label of a single seq
     */
    this._createLabel = function(tSeq){

      var labelGroup = document.createElement("span");

      labelGroup.textContent = tSeq.name;
      labelGroup.seqid= tSeq.id;
      labelGroup.className = "biojs_msa_labels";
      labelGroup.style.width = this.seqOffset + "px";

      labelGroup.addEventListener('click',function(evt){
        var id = this.seqid;
        _self.highlightor.selectSeq(id);
        _self.events.onRowSelect(id);
      }, false);

      if( this.registerMoveOvers === true){
        labelGroup.addEventListener('mouseover',function(evt){
          var id = this.seqid;
          _self.highlightor.selectSeq(id);
          _self.events.onRowSelect(id);
        }, false);
      }

      this.labelColorScheme.colorLabel(labelGroup,tSeq);
      return labelGroup;
    };

    this.orderSeqsAfterScheme = function(type){
      if(typeof type !== "undefined"){
        this.ordering.setType(type);
      }
      this.orderSeqs(this.ordering.getSeqOrder(this.seqs));
    };

    /* 
     * receives an ordered list with seq ids
     */
    this.orderSeqs = function (orderList){
      if(orderList.length != Object.size(this.seqs) ){
        this.log("Length of the input array "+ orderList.length +" does not match with the real world " + Object.size(this.seqs));
        return;
      }

      var spacePerCell = this.columnHeight + this.columnSpacing;
      var val = 0;

      var nMax = 0;
      this.seqs.forEach(function(entry){
        nMax = Math.max(nMax, entry.tSeq.seq.length);
      });


      Utils.removeAllChilds(this._seqMarkerLayer);

      // remove offset
      if(this.visibleElements.labels === false){
        this._seqMarkerLayer.style.paddingLeft= "0px";
      }

      if( this.visibleElements.ruler === true){
        val = spacePerCell;
        this._seqMarkerLayer.appendChild(this._drawSeqMarker(nMax));
        this._seqMarkerLayer.style.paddingLeft= this.seqOffset + "px";
      }

      var frag = document.createDocumentFragment();
      frag.appendChild(this._seqMarkerLayer);
      for(var i=0;i<orderList.length;i++){
        var id = orderList[i];
        this.seqs[id].layer.style.paddingTop= this.columnSpacing +"px";
        //val += spacePerCell;
        frag.appendChild(this.seqs[id].layer);
      }

      Utils.removeAllChilds(this.stage);
      this.stage.appendChild(frag);

      // update width
      this.stage.width = ( this.seqOffset + nMax * this.columnWidth);

    };
    /*
     * redraws the entire MSA
     */
    this.redraw = function(){

      this.highlightor._cleanupSelections();

      // all columns
      for( var curRow in _self.seqs){

        var tSeq = _self.seqs[curRow].tSeq;
        var currentLayer = _self.seqs[curRow].layer;

        // all residues
        var childs = currentLayer.childNodes[1].childNodes;
        for(var i=0; i< childs.length; i++){
          _self.colorscheme.colorResidue(childs[i],tSeq, childs[i].rowPos);
        }

        //labels
        var currentLayerLabel = currentLayer.childNodes[0];
        _self.labelColorScheme.colorLabel(currentLayerLabel,tSeq);

      }
    };

    this.removeSeq = function(id){
      seqs[id].layer.destroy()
      delete seqs[id]

      // reorder
      this.orderSeqsAfterScheme()
    };


    this.redrawEntire = function(){

      var tSeqs = [];
      for( var tSeq in this.seqs){
        tSeqs.push(this.seqs[tSeq].tSeq);
      }
      this.resetStage();
      this.addSequences(tSeqs);
    };


    // TODO: do we create memory leaks here?
    this.resetStage = function() {
      Utils.removeAllChilds(this.stage);
    }
      this.console = undefined;

    this.setConsole = function(name){
      this.console = document.getElementById(name);
    };

    /*
     * some quick & dirty helper
     */
    this.log = function(msg){
      // append as a new line
      //   var msgEl = document.createElement("p");
      //    msgEl.textContent = msg;
      if(typeof this.console !== "undefined" ){
        this.console.innerHTML = msg;
      }
      //  console.log(msg);
    };

    this.events = new Eventhandler(this.log);

  };
});
