jQuery.Controller.extend('ApiPlayground.Controllers.MainController',
/* @Static */
{
	onDocument : true
},
/* @Prototype */
{
	"{window} load" : function() {	
	    var _this = this;

	    SMART.ready(function() {
		$(window).resize(function() {
			h = $(window).height();		
			$("#type-nav").css("min-height", h+"px");
		});
		$(window).resize();
	
		_this.calls = {};
		_this.payload_box = $("#payload");
		_this.response_box = $("#response");
        _this.response_tabs = $("#response_tabs");
        _this.response_tabs.tabs();
		window.jash = new Jash(_this.response_box.get(0));
		window.jash.main();

		_this.payload_box.hide();
		_this.response_box.hide();
        _this.response_tabs.hide();
		ApiType.interpolations.record_id = SMART.record.id;
		ApiType.addInterpolationValue("record_id", SMART.record.id);
		ApiType.find_all_types_and_calls();

	    });
		
    },
    
    'ontology_parsed subscribe': function(topic, element) {
		$("#type-nav").html(this.view('groups', {groups: ApiCallGroup.get_top_groups()}));
		$("#wrap").css({marginLeft: $("#type-nav").width()});
    }, 

    ".type click": function(el, ev ){
		var g = el.closest(".type").model();
		this.selected_top_group = g;
		g.element = el;
		
		$("#type-heading").html(this.view('calls', {group: g}));
		this.payload_box.hide();
		this.response_box.hide();
        this.response_tabs.hide();
		$("#interpolation-fields").html("");
		g.group_type.fetchParameters();

    },
    
    "BUTTON.call click": function(el, ev)
    {

    	var c = el.closest(".call").model();
		this.selected_call = c;
		var method = c.method;
		
		if ($.inArray(method, ApiCall.payload_methods) !== -1) {
      if (c.example !== undefined) { this.payload_box.val(c.example); }
		  else { this.payload_box.val(this.selected_top_group.group_type.example); }
      ex = this.payload_box.val();

      // remove rdf:about property
      var res = SMART.process_rdf("application/rdf+xml", ex.replace(/ rdf:about=".*?"/, ''));

      // remove the belongsTo triple
      res.where('?s sp:belongsTo ?o').remove('?s sp:belongsTo ?o');

      // serialize and beautify
      dump = res.databank.dump({format:'application/rdf+xml', serialize: true});
      this.payload_box.val(vkbeautify.xml(dump, 4));
      this.payload_box.show();	

		} else  {
			this.payload_box.val("");
			this.payload_box.hide();
		}

    //console.log('pb: ', this.payload_box.val());

		this.response_box.hide();
        this.response_tabs.hide()
		
		$("#interpolation-fields").html(this.view('interpolations', {type: this.selected_top_group.group_type, 
																	 call: this.selected_call}));
		$("#interpolation-fields INPUT").each(function() {
			$i = $(this);
			var field_name = $i.attr("field_name");
			
			var compfunc = function(request, response) {
				try {
				//console.log("looking up " + field_name + ": " + ApiType.interpolations.lists[field_name].join(", "));
				response(ApiType.interpolations.lists[field_name]);
				} catch(err) {response([]);}
			};
			
			$i.autocomplete(
				{source: compfunc,
				 minLength: 0, 
				 delay: 0,
				 close: function() {$(this).data("close_handled", false);}})
				.focus(function () {					
				 		var close_handled = $(this).data("close_handled");
						if (close_handled) {
						   $(this).keydown(); 
						}					
				 		$(this).data("close_handled", true);					
				}).data("close_handled", true);
			try  {$i.val(ApiType.interpolations.lists[field_name][0]);} catch(err){}
			
		});
		
   },

    "BUTTON.cancel-call click": function(el, ev) {
    	this.selected_top_group.element.click();
    
    },
    
    "BUTTON.complete-call click": function(el, ev) {
    	$(".cancel-call").attr("DISABLED", "true");
		$(".complete-call").attr("DISABLED", "true");
	
    	$("#interpolation-fields INPUT").each(function() {
			$i = $(this);
			var field_name = $i.attr("field_name");
    		ApiType.interpolations[field_name] = $i.val();
    		$i.attr("DISABLED", "true");
    	});
    	
    	this.selected_call.callAPI( this.payload_box.val(), 
    								this.callback(this.receivedResult))
    },
    
    receivedResult: function(res) {

        if (res.contentType === "application/rdf+xml") {
            
            res.ntriples = "";
            res.graph.where('?s ?p ?o')
                .each(function(){
                    res.ntriples += this.s.toString() + " " + this.p.toString() + " " + this.o.toString() + " .\n";
                });
            
            $("#tab_rdf pre").text(res.body);
            $("#tab_ntriples pre").text(res.ntriples);

            var o = SMART.break_json_cycles(res.objects.of_type);
            $("#tab_jsonld pre").text(JSON.stringify(o, null, "  "));
            
            // Arbitrary limit on the code pretification (it's not very efficient and
            // hoses the browser up for large chunks of code)
            if (res.body.length <= 4096) {
                // Reset the pretty print processed flag
                $('pre.prettyprint').removeClass('prettyprinted');
                
                // Now prettify
                prettyPrint();
            }
            
            this.response_tabs.show()
            
            window.response = res;
            window.jash.clear();
            window.jash.output.value = window.jash.defaultText;
            window.jash.output.value += "\n";
            window.jash.output.value += "Triples in RDF graph returned: " + response.graph.where('?s ?p ?o.').length+"\n\n";
            window.jash.output.value += "To explore the graph, try:\n";
            window.jash.output.value += "  > response.body\n";
            window.jash.output.value += "  > response.graph.where('?s ?p ?o.').length\n";
            window.jash.output.value += "  > response.graph.where('?s ?p ?o.')[0].s\n";
            window.jash.output.value += "  > JSON.stringify(response.objects,null,'  ')\n";
                this.response_box.show();
            window.jash.print("\nTo explore type or paste commands in the textbox below, then press Enter.");
            window.jash.input.focus();
                $(".cancel-call").removeAttr("DISABLED");
                $(".complete-call").removeAttr("DISABLED");
                $("#interpolation-fields INPUT").each(function() {
                    $i = $(this);
                    $i.removeAttr("DISABLED");
                });
        } else {
            window.jash.clear();
            window.jash.output.value = res.body;
            window.jash.output.value += "\n\n------------\n";
            window.jash.output.value += window.jash.defaultText;
            window.jash.output.value += "\n";
            this.response_box.show();
        }

    	this.selected_top_group.group_type.fetchParameters();		
    }
    
});
