// JavaScript Document

var InterfaceMaster = (function () {
    var instance;

    function createInstance() {


        var object = new interfaceObject();

		function interfaceObject(){

			var gm;
			var battle;
			var ranker = RankerMaster.getInstance();
			var pokeSelectors = [];
			var multiSelectors = [
				new PokeMultiSelect($(".team .poke.multi")),
				new PokeMultiSelect($(".custom-threats .poke.multi")),
				new PokeMultiSelect($(".custom-alternatives .poke.multi")),
				new PokeMultiSelect($(".exclude-alternatives .poke.multi")),
				new PokeMultiSelect($(".exclude-threats .poke.multi"))
			];
			var results; // Store team matchup results for later reference
			var altRankings; // Store alternatives for searching
			var counterTeam;
			var self = this;
			var runningResults = false;

			var histograms = [];

			this.context = "team";


			this.init = function(){

				gm = GameMaster.getInstance();
				var data = gm.data;

				battle = new Battle();

				pokeSearch.setBattle(battle);

				for(var i = 0; i < multiSelectors.length; i++){
					multiSelectors[i].init(data.pokemon, battle);
				}

				multiSelectors[0].setMaxPokemonCount(3);
				multiSelectors[0].setContext("team");


				$(".format-select").on("change", selectFormat);
				$(".rate-btn").on("click", rateClick);
				$(".print-scorecard").on("click", printScorecard);
				$("body").on("click", ".alternatives-table .button.add", addAlternativePokemon);
				$("body").on("click", ".core-recommendation-card", selectCoreRecommendation);
				$("body").on("click", ".core-card-add", addCoreRecommendation);
				$("body").on("click", ".check", checkBox);
				$(".team-size-select").on("change", selectTeamSize);

				// If get data exists, load settings

				this.loadGetData();

				// Load rankings for the current league

				if(! get){
					gm.loadRankingData(self, "overall", parseInt($(".format-select option:selected").attr("value")), "all");
				}

				window.addEventListener('popstate', function(e) {
					get = e.state;
					self.loadGetData();
				});
			};

			// Given JSON of get parameters, load these settings

			this.loadGetData = function(){

				// Clear all currently selected Pokemon

				for(var i = 0; i < pokeSelectors.length; i++){
					pokeSelectors[i].clear();
				}

				$(".section.typings").hide();

				if(! get){
					return false;
				}

				// Cycle through parameters and set them

				for(var key in get){
					if(get.hasOwnProperty(key)){

						var val = get[key];

						// Process each type of parameter

						switch(key){
							case "t":
								// Load group by id or load Pokemon by URL parameter list
								if(multiSelectors[0].groupExists(val)){
									multiSelectors[0].selectGroup(val);
								} else{
									// Set max team size to length of list, if option exists
									var list = val.split(",");

									$(".team-size-select option[value="+list.length+"]").prop("selected", "selected");
									$(".team-size-select").trigger("change");

									multiSelectors[0].quickFillURLParam(val);
								}
								break;

							case "cp":
								//Parse this out if it contains level cap
								var getCP = val;

								if(val.indexOf("-") > -1){
									getCP = val.split("-")[0];
								}

								battle.setCP(getCP);

								// Set format

								$(".format-select option[value=\""+getCP+"\"][cup=\""+battle.getCup().name+"\"]").prop("selected","selected");
								break;

							case "cup":
								battle.setCup(val);

								if(battle.getCup().tierRules){
									multiSelectors[0].setCliffhangerMode(true);
								} else{
									multiSelectors[0].setCliffhangerMode(false);
								}

								if(battle.getCup().partySize == 8){
									$(".team-size-select option[value=8]").prop("selected", "selected");
									$(".team-size-select").trigger("change");
								}

								if(battle.getCup().allowSameSpecies){
									$(".check.same-species").addClass("on");
								}
								break;
						}
					}

				}

				// Update both Pokemon selectors

				for(var i = 0; i < pokeSelectors.length; i++){
					pokeSelectors[i].update();
				}

				// Auto run the battle

				$(".rate-btn").trigger("click");
			}

			// Callback for loading ranking data

			this.displayRankingData = function(data){
				console.log("Ranking data loaded");

				if(runningResults){
					self.updateTeamResults();

					$("html, body").animate({ scrollTop: $(".section.typings a").first().offset().top }, 500);


					$(".rate-btn .btn-label").html("Rate Team");
				} else{
					// Update MultiSelect to display Pokemon eligibility

					multiSelectors[0].updateListDisplay();
				}
			}

			// Update team info output

			this.updateTeamResults = function(){
				var key = battle.getCup().name + "overall" + battle.getCP();

				if(! gm.rankings[key]){
					runningResults = true;
					gm.loadRankingData(self, "overall", battle.getCP(), battle.getCup().name);
					return false;
				}

				var metaKey = $(".format-select option:selected").attr("meta-group");

				if(! gm.groups[metaKey]){
					runningResults = true;
					gm.loadGroupData(self, metaKey);
					return false;
				}

				var metaGroup = gm.groups[metaKey];

				// Gather advanced settings
				var scorecardCount = parseInt($(".scorecard-length-select option:selected").val());
				var maxThreatsToShow = Math.min(20, Math.max(10, scorecardCount));
				var allowShadows = $(".team-option .check.allow-shadows").hasClass("on");
				var allowXL = $(".team-option .check.allow-xl").hasClass("on");
				var baitShields = $(".team-option .check.shield-baiting").hasClass("on") ? 1 : 0;
				var prioritizeMeta = $(".team-option .check.prioritize-meta").hasClass("on");

				if(battle.getCup().name == "shadow"){
					allowShadows = true;
				}

				// Get team and validate results

				var team = multiSelectors[0].getPokemonList();

				if(team.length == 0){
					$(".section.error").show();
					return false;
				}

				// Process defensive and offensive matchups

				var defenseArr = [];
				var offenseArr = [];

				for(var i = 0; i < team.length; i++){
					var poke = team[i];

					defenseArr.push(
						{
							name: poke.speciesName,
							type: poke.types[0],
							matchups: this.getTypeEffectivenessArray(poke.types, "defense")
						});

					// Gather offensive matchups for fast move

					offenseArr.push(
						{
							name: poke.fastMove.name,
							type: poke.fastMove.type,
							matchups: this.getTypeEffectivenessArray([poke.fastMove.type], "offense")
						});

					// Gather offensive matchups for all charged moves

					for(var n = 0; n < poke.chargedMoves.length; n++){
						if(poke.chargedMoves[n]){
							offenseArr.push(
								{
									name: poke.chargedMoves[n].name,
									type: poke.chargedMoves[n].type,
									matchups: this.getTypeEffectivenessArray([poke.chargedMoves[n].type], "offense")
								});
						}

					}
				}

				// Display data

				$(".typings").show();

				this.displayArray(defenseArr, "defense");
				this.displayArray(offenseArr, "offense");
				this.generateSummaries(defenseArr, offenseArr);

				// Generate counters and histograms, and display that, too
				var shieldMode = $(".team-advanced .flex.poke .shield-select option:selected").val();
				var shieldCount = 1;

			if(shieldMode != "average" && shieldMode != "all"){
				shieldCount = parseInt(shieldMode);
				shieldMode = "single";
			}

			var teamSettings = getDefaultMultiBattleSettings();
			var opponentSettings = getDefaultMultiBattleSettings();

			teamSettings.shields = opponentSettings.shields = shieldCount;
				ranker.applySettings(teamSettings, 0);
				ranker.applySettings(opponentSettings, 1);
				ranker.setShieldMode(shieldMode);
				ranker.setMetaGroup(metaGroup);
				ranker.setPrioritizeMeta(prioritizeMeta);

				ranker.setRecommendMoveUsage(true);

				// Set targets for custom threats
				if(multiSelectors[1].getPokemonList().length > 0){
					ranker.setTargets(multiSelectors[1].getPokemonList());
					ranker.setRecommendMoveUsage(false);
				}

				var data = ranker.rank(team, battle.getCP(), battle.getCup(), [], "team-counters");
				var counterRankings = data.rankings;
				var teamRatings = data.teamRatings;

				counterTeam = [];

				// Clear targets so it will default to the normal format if the user changes settings
				ranker.setTargets([]);

				results = counterRankings;

				// Let's start with the histograms, because they're kinda neat

				for(var i = 0; i < team.length; i++){
					if(histograms.length <= i){
						var histogram = new BattleHistogram($(".histogram").eq(i));
						histogram.generate(team[i], teamRatings[i]);

						histograms.push(histogram);
					} else{
						histograms[i].generate(team[i], teamRatings[i]);
					}
				}

				// Potential threats

				var csv = ','; // CSV data of all matchups
				$(".section.typings .rankings-container").html('');
				$(".threats-table").html("");
				$(".meta-table").html("");

				var $row = $("<thead><tr><td class=\"arrow\"></td></tr></thead>");

				for(var n = 0; n < team.length; n++){
					$row.find("tr").append("<td class=\"name-small\">"+team[n].speciesName+"</td>");

					csv += team[n].speciesName + ' ' + team[n].generateMovesetStr();
					if(n < team.length -1){
						csv += ',';
					}
				}

				csv += ',Threat Score,Overall Rating';

				$(".threats-table").append($row);
				$(".meta-table").append($row.clone());
				$(".threats-table").append("<tbody></tbody>");
				$(".meta-table").append("<tbody></tbody>");

				var avgThreatScore = 0;
				var count = 0;
				var total = scorecardCount;
				var excludedThreats = multiSelectors[4].getPokemonList();
				var excludedThreatIDs = [];

				for(var i = 0; i < excludedThreats.length; i++){
					// Include shadow ID's for Shadow Pokemon
					var excludedId = excludedThreats[i].speciesId;

					if((excludedThreats[i].shadowType == "shadow")&&(excludedId.indexOf("_shadow") == -1)){
						excludedId = excludedId + "_shadow";
					}

					excludedThreatIDs.push(excludedId);
				}

				var i = 0;

				while((count < total || counterTeam.length < 6)&&(i < counterRankings.length)){
					var r = counterRankings[i];

					// Don't exclude threats that are part of a custom threat list

					if(multiSelectors[1].getPokemonList().length == 0){
						if((r.speciesId.indexOf("_shadow") > -1)&&(! allowShadows)){
							i++;
							continue;
						}

						if(r.speciesId.indexOf("_xs") > -1){
							i++;
							continue;
						}

						if(r.pokemon.hasTag("teambuilderexclude")){
							i++;
							continue;
						}
					}


					if(excludedThreatIDs.indexOf(r.speciesId) > -1){
						i++;
						continue;
					}

					var pokemon = r.pokemon;

					// Push to counter team
					if(counterTeam.length < maxThreatsToShow){
						let similarCounterExists = counterTeam.some(counter => {
							let similarityScore = counter.calculateSimilarity(pokemon, pokemon?.traits, false);

							return similarityScore == -1 || similarityScore >= 1000;
						});

						//let isMeta = (metaGroup.some(poke => poke.speciesId.replace("_shadow", "") == pokemon.speciesId.replace("_shadow", "")));

						let customThreatsListLength = multiSelectors[1].getPokemonList().length;
						if(! similarCounterExists || (customThreatsListLength != 0 && customThreatsListLength <= 12)){
							counterTeam.push(pokemon);

							avgThreatScore += r.rating;
						}
					}

					// Add results to threats table
					if(count >= total){
						i++;
						continue;
					}

					$row = $("<tr><th class=\"name\"><b>"+(count+1)+". "+pokemon.speciesName+"</b></th></tr>");

					for(var n = 0; n < r.matchups.length; n++){
						var $cell = $("<td><a class=\"rating\" href=\"#\" target=\"blank\"><span></span></a></td>");
						var rating = r.matchups[n].rating;

						$cell.find("a").addClass(battle.getRatingClass(rating));

						if(! baitShields){
							pokemon.isCustom = true;
							pokemon.baitShields = 0;
							r.matchups[n].opponent.isCustom = true;
							r.matchups[n].opponent.baitShields = 0;
						}

						var pokeStr = pokemon.generateURLPokeStr();
						var moveStr = pokemon.generateURLMoveStr();
						var opPokeStr = r.matchups[n].opponent.generateURLPokeStr();
						var opMoveStr = r.matchups[n].opponent.generateURLMoveStr();
						var shieldStr = shieldCount + "" + shieldCount;
						var battleLink = host+"battle/"+battle.getCP(true)+"/"+pokeStr+"/"+opPokeStr+"/"+shieldStr+"/"+moveStr+"/"+opMoveStr+"/";
						$cell.find("a").attr("href", battleLink);

						$row.append($cell);
					}

					i++;
					count++;

					$(".threats-table tbody").append($row);
				}

				// Display average threat score
				avgThreatScore = Math.round(avgThreatScore / 6);
				$(".threat-score").html(avgThreatScore);

				// Build CSV results

				for(var i = 0; i < counterRankings.length; i++){
					var r = counterRankings[i];

					csv += '\n';

					csv += r.speciesName + ' ' + r.pokemon.generateMovesetStr() + ',';

					for(var n = 0; n < r.matchups.length; n++){
						csv += r.matchups[n].rating;

						if(n < r.matchups.length-1){
							csv += ',';
						}
					}

					csv += ',' + (Math.round(r.score*10)/10) + ',' + r.overall;
				}

				// Display meta scorecard
				if(multiSelectors[1].getPokemonList().length == 0){
					counterRankings.sort((a,b) => (a.overall > b.overall) ? -1 : ((b.overall > a.overall) ? 1 : 0));
				} else{
					counterRankings.sort((a,b) => (a.speciesName > b.speciesName) ? 1 : ((b.speciesName > a.speciesName) ? -1 : 0));
				}


				count = 0;
				total = scorecardCount;
				i = 0;

				while((count < total)&&(i < counterRankings.length)){
					var r = counterRankings[i];

					if(multiSelectors[1].getPokemonList().length == 0){
						if((r.speciesId.indexOf("_shadow") > -1)&&(! allowShadows)){
							i++;
							continue;
						}

						if((r.speciesId.indexOf("_xs") > -1)&&(allowXL)){
							i++;
							continue;
						}
					}

					if(excludedThreatIDs.indexOf(r.speciesId) > -1){
						i++;
						continue;
					}

					if((r.pokemon.needsXLCandy())&&(! allowXL)){
						i++;
						continue;
					}

					// Skip Pokemon if it isn't in the current meta group
					if(multiSelectors[1].getPokemonList().length == 0){
						var inMetaGroup = false;

						for(var n = 0; n < metaGroup.length; n++){
							var searchId = metaGroup[n].speciesId;
							searchId = searchId.replace("_xs","");
							searchId = searchId.replace("_xl","");

							if(searchId == r.speciesId){
								inMetaGroup = true;
							}
						}

						if(! inMetaGroup){
							i++;
							continue;
						}
					}

					var pokemon = r.pokemon;

					// Add results to meta table

					$row = $("<tr><th class=\"name\"><b>"+pokemon.speciesName+"</b></th></tr>");

					for(var n = 0; n < r.matchups.length; n++){
						var $cell = $("<td><a class=\"rating\" href=\"#\" target=\"blank\"><span></span></a></td>");
						var rating = r.matchups[n].rating;

						$cell.find("a").addClass(battle.getRatingClass(rating));

						if(! baitShields){
							pokemon.isCustom = true;
							pokemon.baitShields = 0;
							r.matchups[n].opponent.isCustom = true;
							r.matchups[n].opponent.baitShields = 0;
						}

						var pokeStr = pokemon.generateURLPokeStr();
						var moveStr = pokemon.generateURLMoveStr();
						var opPokeStr = r.matchups[n].opponent.generateURLPokeStr();
						var opMoveStr = r.matchups[n].opponent.generateURLMoveStr();
						var shieldStr = shieldCount + "" + shieldCount;
						var battleLink = host+"battle/"+battle.getCP(true)+"/"+pokeStr+"/"+opPokeStr+"/"+shieldStr+"/"+moveStr+"/"+opMoveStr+"/";
						$cell.find("a").attr("href", battleLink);

						$row.append($cell);
					}

					i++;
					count++;

					$(".meta-table tbody").append($row);
				}

				// And for kicks, generate the counters to those counters

				var exclusionList = []; // Exclude the current team from the alternative results

				for(var i = 0; i < team.length; i++){
					exclusionList.push(team[i].speciesId);
				}

				// Exclude any Pokemon specified in the advanced settings

				var excludedAlternatives = multiSelectors[3].getPokemonList();

				for(var i = 0; i < excludedAlternatives.length; i++){
					// Include shadow ID's for Shadow Pokemon
					var excludedId = excludedAlternatives[i].speciesId;

					if((excludedAlternatives[i].shadowType == "shadow")&&(excludedId.indexOf("_shadow") == -1)){
						excludedId = excludedId + "_shadow";
					}

					exclusionList.push(excludedId);
				}

				// In Cliffhanger, exclude Pokemon that would put the team over the point limit
				var tiers = [];

				if(battle.getCup().tierRules){
					var cliffObj = multiSelectors[0].calculateCliffhangerPoints();
					var remainingPoints = cliffObj.max - cliffObj.points;
					tiers = cliffObj.tiers;
					var remainingPicks = 6 - team.length;

					// Reduce remaining points by the cost of remaining picks so incompatible tiers aren't suggested
					remainingPoints -= (remainingPicks - 1) * cliffObj.floor;

					// Add ineligible tiers to the exclusion list
					for(var i = 0; i < tiers.length; i++){
						if(remainingPoints < tiers[i].points){
							for(var n = 0; n < tiers[i].pokemon.length; n++){
								exclusionList.push(tiers[i].pokemon[n]);
								exclusionList.push(tiers[i].pokemon[n]+"_shadow");
								exclusionList.push(tiers[i].pokemon[n]+"_xl");
							}
						}
					}
				}

				// If using a restricted Pokemon, exclude restricted list

				if(battle.getCup().restrictedPokemon){
					var restrictedPicks = 0;

					for(var i = 0; i < team.length; i++){
						if(battle.getCup().restrictedPokemon.indexOf(team[i].speciesId.replace("shadow","")) > -1){
							restrictedPicks++;
						}
					}

					if(restrictedPicks >= battle.getCup().restrictedPicks){
						for(var n = 0; n < battle.getCup().restrictedPokemon.length; n++){
							exclusionList.push(battle.getCup().restrictedPokemon[n]);
						}
					}
				}

				ranker.setRecommendMoveUsage(true);

				// Set targets for custom alternatives
				if(multiSelectors[2].getPokemonList().length > 0){
					ranker.setTargets(multiSelectors[2].getPokemonList());
					ranker.setRecommendMoveUsage(false);
				}

				$(".poke-search[context='alternative-search']").val('');

				altRankings = ranker.rank(counterTeam, battle.getCP(), battle.getCup(), exclusionList, "team-alternatives").rankings;
				var threatEntries = [];
				for(var i = 0; i < counterTeam.length; i++){
					var match = counterRankings.filter(function(entry){
						return entry.speciesId == counterTeam[i].speciesId || entry.speciesName == counterTeam[i].speciesName;
					})[0];

					if(match){
						threatEntries.push(match);
					}
				}

				for(var i = 0; i < altRankings.length; i++){
					altRankings[i].coreAnalysis = self.getCoreAnalysis(team, altRankings[i], counterTeam, threatEntries, metaGroup);
					altRankings[i].coreScore = altRankings[i].coreAnalysis ? (altRankings[i].coreAnalysis.coreScore || altRankings[i].coreAnalysis.pairScore || 0) : 0;
				}

				altRankings.sort((a,b) => (b.coreScore > a.coreScore) ? 1 : ((a.coreScore > b.coreScore) ? -1 : 0));
				for(var i = 0; i < altRankings.length; i++){
					altRankings[i].coreRank = i + 1;
					altRankings[i].coreTier = i < 3 ? "Recommended" : (i < 10 ? "Candidate" : "Reserve");
				}
				self.displayCoreRecommendations(altRankings.slice(0, 10));
				self.displayAlternatives();

				// Clear targets so it will default to the normal format if the user changes settings
				ranker.setTargets([]);



				// Set download link data
				var cupTitle = "All Pokemon";
				if(battle.getCup().title){
					cupTitle = battle.getCup().title;
				}
				var filename = "Team vs. " + cupTitle + ".csv";
				var filedata = '';

				if (!csv.match(/^data:text\/csv/i)) {
					filedata = [csv];
					filedata = new Blob(filedata, { type: 'text/csv'});
				}

				$(".button.download-csv").attr("href", window.URL.createObjectURL(filedata));
				$(".button.download-csv").attr("download", filename);


				// Update page title with team name

				var teamNameStr = team[0].speciesName;
				var i = 1;

				for(i = 1; i < Math.min(team.length, 3); i++){
					teamNameStr += ", " + team[i].speciesName;
				}

				if(i < team.length){
					teamNameStr += "+" + (team.length - i);
				}

				document.title = teamNameStr + " - Team Builder | PvPoke";


				runningResults = false;
			}

			this.getAlternativeSummary = function(ranking){
				var ratings = ranking.matchups.map(function(matchup){
					return matchup.rating;
				});
				var scenarioSpreads = ranking.matchups.map(function(matchup){
					if(! matchup.scenarioRatings || matchup.scenarioRatings.length < 2){
						return 0;
					}
					return Math.max.apply(null, matchup.scenarioRatings) - Math.min.apply(null, matchup.scenarioRatings);
				});
				var avgRating = Math.round(ratings.reduce(function(sum, value){
					return sum + value;
				}, 0) / ratings.length);
				var minRating = Math.round(Math.min.apply(null, ratings));
				var scenarioSpread = Math.round(Math.max.apply(null, scenarioSpreads));

				var winCount = ratings.filter(function(value){
					return value >= 700;
				}).length;
				var closeWinCount = ratings.filter(function(value){
					return value >= 600 && value < 700;
				}).length;
				var tieCount = ratings.filter(function(value){
					return value >= 400 && value < 600;
				}).length;
				var closeLossCount = ratings.filter(function(value){
					return value >= 300 && value < 400;
				}).length;
				var lossCount = ratings.filter(function(value){
					return value < 300;
				}).length;

				var bestIndex = ratings.reduce(function(bestIndex, value, index, array){
					return value > array[bestIndex] ? index : bestIndex;
				}, 0);
				var worstIndex = ratings.reduce(function(worstIndex, value, index, array){
					return value < array[worstIndex] ? index : worstIndex;
				}, 0);

				var coreScore = ranking.coreAnalysis ? Math.round(ranking.coreScore) : null;
				var label = coreScore === null ? "Matchup reference" : (ranking.coreTier || (coreScore >= 75 ? "Strong core" : (coreScore >= 55 ? "Usable core" : "Weak core")));
				var coreAnalysis = ranking.coreAnalysis;
				var coreDetails = "";
				var coreTitle = "";
				if(coreAnalysis){
					var gapsCount = Array.isArray(coreAnalysis.criticalGaps) ? coreAnalysis.criticalGaps.length : 0;
					coreDetails = "coverage " + Math.round(coreAnalysis.threatCoverage) + " • added " + Math.round(coreAnalysis.marginalCoverage) + " • gaps " + gapsCount;
					var existingWeaknesses = Array.isArray(coreAnalysis.existingPairWeaknesses) ? coreAnalysis.existingPairWeaknesses.join(", ") : "none";
					var candidateWeaknesses = Array.isArray(coreAnalysis.candidatePairWeaknesses) ? coreAnalysis.candidatePairWeaknesses.join(", ") : "none";
					var coreBreakers = Array.isArray(coreAnalysis.coreBreakers) ? coreAnalysis.coreBreakers.join(", ") : "none";
					coreTitle = "Existing duo score " + Math.round(coreAnalysis.existingPairScore) + ". Candidate pair support " + Math.round(coreAnalysis.candidatePairSupport) + ". Existing duo shared weaknesses: " + existingWeaknesses + ". Candidate pair weaknesses: " + candidateWeaknesses + ". Remaining core breakers: " + coreBreakers;
				}

				return {
					primary: label,
					secondary: (coreScore === null ? "" : "core " + coreScore + " • " + coreDetails + " • ") + avgRating + " avg • min " + minRating + " • volatility " + scenarioSpread,
					title: coreTitle + " Core score and neutral scenario volatility. W = win, CW = close win, T = tie, CL = close loss, L = loss. Best vs " + ranking.matchups[bestIndex].opponent.speciesName + " (" + ratings[bestIndex] + "), weakest vs " + ranking.matchups[worstIndex].opponent.speciesName + " (" + ratings[worstIndex] + ")"
				};
			};

			this.displayCoreRecommendations = function(rankings){
				var $list = $(".core-recommendation-list");
				$list.html("");
				var selectedTeam = multiSelectors[0].getPokemonList();
				if(selectedTeam.length >= 3){
					$(".core-recommendation-meta").html("Current line");
					$(".core-recommendation-intro").html("This line is complete. Review its roles and matchup matrix below.");
					$list.html("<p class=\"core-complete-message\">Three Pokemon selected. Remove one Pokemon to explore third-pick recommendations.</p>");
					$(".core-detail-panel").html("");
					return;
				}
				$(".core-recommendation-meta").html(rankings.length + " candidates analyzed");

				if(! rankings.length){
					$list.html("<p>No compatible third Pokemon candidates were found.</p>");
					return;
				}

				rankings.forEach(function(ranking, index){
					var analysis = ranking.coreAnalysis;
					var score = Math.round(ranking.coreScore || 0);
					var added = (analysis && Number.isFinite(analysis.marginalCoverage)) ? Math.round(analysis.marginalCoverage) : 0;
					var gaps = (analysis && Array.isArray(analysis.criticalGaps)) ? analysis.criticalGaps.length : 0;
					var line = analysis && analysis.bestLine ? analysis.bestLine.names.join(" / ") : "Line unavailable";
					var $card = $("<div class=\"core-recommendation-card\" role=\"button\" tabindex=\"0\"></div>");
					$card.attr("data-species-id", ranking.speciesId);
					$card.append("<span class=\"core-card-rank\">" + (index + 1) + "</span>");
					$card.append("<span class=\"core-card-name\"><strong>" + ranking.speciesName + "</strong><small>" + (ranking.coreTier || "Candidate") + "</small></span>");
					$card.append("<span class=\"core-card-metric\" title=\"Core score: combined trio quality\"><span class=\"core-card-icon\" aria-hidden=\"true\">&#9733;</span><strong>" + score + "</strong></span>");
					$card.append("<span class=\"core-card-metric\" title=\"Added coverage: additional threat coverage from this Pokemon\"><span class=\"core-card-icon\" aria-hidden=\"true\">&#43;</span><strong>" + added + "</strong></span>");
					$card.append("<span class=\"core-card-metric\" title=\"Core gaps: remaining critical or uncertain threats\"><span class=\"core-card-icon\" aria-hidden=\"true\">&#9888;</span><strong>" + gaps + "</strong></span>");
					$card.append("<span class=\"core-card-line\"><small>Best line</small>" + line + "</span>");
					$card.append("<button type=\"button\" class=\"core-card-add\" title=\"Add " + ranking.speciesName + " to the team\" pokemon=\"" + ranking.speciesId + "\" alias=\"" + (ranking.pokemon.aliasId || ranking.speciesId) + "\" aria-label=\"Add " + ranking.speciesName + " to the team\">+</button>");
					$list.append($card);
				});

				this.showCoreRecommendation(rankings[0]);
			};

			this.showCoreRecommendation = function(ranking){
				var $panel = $(".core-detail-panel");
				if(! ranking || ! ranking.coreAnalysis){
					$panel.html("");
					return;
				}

				var analysis = ranking.coreAnalysis;
				var gapsHtml = "";
				var threatsHtml = "";
				var marginalCoverage = 0;
				var viableLineCount = 0;
				var threatCoverage = 0;
				var existingWeaknesses = [];
				var candidateWeaknesses = [];
				var coreBreakers = [];
				if(analysis){
					if(Array.isArray(analysis.criticalGaps)){
						gapsHtml = analysis.criticalGaps.slice(0, 8).map(function(gap){ return '<li class="gap-item"><span class="gap-severity">' + gap.severity + '</span>: ' + gap.name + ' <span class="gap-rating">(' + Math.round(gap.rating) + ')</span></li>'; }).join("");
					}
					if(Array.isArray(analysis.threatAnalysis)){
						var covered = analysis.threatAnalysis.filter(function(item){ return item.status == "covered"; }).slice(0, 12);
						threatsHtml = covered.map(function(item){ return '<span class="threat-chip">' + item.threat + '</span>'; }).join(' ');
					}
					marginalCoverage = Number.isFinite(analysis.marginalCoverage) ? Math.round(analysis.marginalCoverage) : 0;
					viableLineCount = (typeof analysis.viableLineCount === 'number') ? analysis.viableLineCount : 0;
					threatCoverage = Number.isFinite(analysis.threatCoverage) ? Math.round(analysis.threatCoverage) : 0;
					existingWeaknesses = Array.isArray(analysis.existingPairWeaknesses) ? analysis.existingPairWeaknesses.slice(0,6) : [];
					candidateWeaknesses = Array.isArray(analysis.candidatePairWeaknesses) ? analysis.candidatePairWeaknesses.slice(0,6) : [];
					coreBreakers = Array.isArray(analysis.coreBreakers) ? analysis.coreBreakers.slice(0,6) : [];
				}

				// Build improvement suggestions
				var improvements = [];
				if(candidateWeaknesses.length){ improvements.push('Consider counters for: ' + candidateWeaknesses.join(', ')); }
				if(coreBreakers.length){ improvements.push('Address remaining core breakers: ' + coreBreakers.join(', ')); }
				if(!improvements.length){ improvements.push('No immediate changes required; this pick closes most gaps.'); }

				// Build viable lines visual (6 segments)
				var linesHtml = '';
				var viableCount = 0;
				var borderlineCount = 0;
				if(Array.isArray(analysis.lineOrders) && analysis.lineOrders.length){
					var orders = analysis.lineOrders.slice(0,6);
					orders.forEach(function(order){
						var score = Math.round(order.lineScore || 0);
						var cls = '';
						if(score >= 45){ cls = ' filled'; viableCount++; }
						else if(score >= 40){ cls = ' borderline'; borderlineCount++; }
						var title = (order.names ? order.names.join(' / ') : 'Order') + ' — ' + score + '%';
						linesHtml += '<span class="line-block' + cls + '" title="' + title + '"></span>';
					});
				} else {
					for(var i=0;i<6;i++){
						linesHtml += '<span class="line-block' + (i < viableLineCount ? ' filled' : '') + '"></span>';
					}
					viableCount = viableLineCount;
				}

				var html = '';
				html += '<div class="core-detail-header"><strong>' + ranking.speciesName + ' completes the duo</strong><span title="Core score">' + Math.round(ranking.coreScore || 0) + ' / 100</span></div>';
				html += '<div class="core-detail-grid">';
				// Coverage & lines
				html += '<div class="core-metrics">';
				html += '<div class="coverage"><b>Coverage</b><div class="coverage-bar" title="Threat coverage">';
				html += '<div class="coverage-fill" style="width:' + Math.max(0, Math.min(100, threatCoverage)) + '%"></div>';
				if(marginalCoverage > 0){ html += '<div class="coverage-add" style="width:' + Math.max(0, Math.min(100, marginalCoverage)) + '%"></div>'; }
				html += '</div><div class="coverage-label">Current: ' + threatCoverage + '% • +' + marginalCoverage + '% added</div></div>';
				html += '<div class="viable-lines"><b>Viable lines <span class="viable-info-toggle" title="What this means">i</span></b>';
				html += '<div class="viable-info-popup" style="display:none;">';
				html += '<p><strong>Filled:</strong> lines with score ≥ 45% are considered viable.</p>';
				html += '<p><strong>Borderline:</strong> lines with score 40–44% — near misses you can improve.</p>';
				html += '<p>Hover a block to see the line and its score. Try changing moves or swapping weak roles to raise a borderline line above 45%.</p>';
				html += '</div>';
				html += '<div class="lines">' + linesHtml + '</div><div class="lines-label">' + viableCount + ' / 6 viable lines' + (borderlineCount ? ' (' + borderlineCount + ' borderline)' : '') + '</div></div>';
				html += '</div>';

				// Covered threats
				html += '<div class="covered-threats"><b>Covered threats</b><div class="threat-list">' + (threatsHtml || '<em>None</em>') + '</div></div>';

				// Remaining gaps + improvements
				html += '<div class="remaining-gaps"><b>Remaining gaps</b><ul class="gaps-list">' + (gapsHtml || '<li><em>None</em></li>') + '</ul>';
				html += '<div class="improve"><b>How to improve</b><ul class="improve-list"><li>' + improvements.join('</li><li>') + '</li></ul></div>';
				html += '</div>';

				html += '</div>';

				$panel.html(html);

				// Attach info popup toggle and document click handler (namespaced to avoid duplicates)
				var $popup = $panel.find('.viable-info-popup');
				$panel.find('.viable-info-toggle').off('click').on('click', function(e){ e.stopPropagation(); $popup.toggle(); });
				$(document).off('click.teamInterfaceViableInfo').on('click.teamInterfaceViableInfo', function(){ $popup.hide(); });
			};

			this.getCoreAnalysis = function(team, candidateRanking, counterTeam, threatEntries, metaGroup){
				var members = team.slice();
				if(members.length >= 3){
					return null;
				}
				members.push(candidateRanking.pokemon);

				var matchupData = {};
				members.forEach(function(member){ matchupData[member.speciesId] = []; });

				for(var i = 0; i < counterTeam.length; i++){
					var threat = counterTeam[i];
					var threatEntry = threatEntries[i];
					var candidateMatchup = candidateRanking.matchups[i];

					for(var n = 0; n < team.length; n++){
						var reverseMatchup = threatEntry && threatEntry.matchups ? threatEntry.matchups[n] : null;
						matchupData[team[n].speciesId].push({
							threatId: threat.speciesId,
							rating: reverseMatchup ? 1000 - reverseMatchup.rating : 0,
							scenarioRatings: reverseMatchup && reverseMatchup.scenarioRatings ? reverseMatchup.scenarioRatings.map(function(value){ return 1000 - value; }) : null
						});
					}

					matchupData[candidateRanking.pokemon.speciesId].push({
						threatId: threat.speciesId,
						rating: candidateMatchup ? candidateMatchup.rating : 0,
						scenarioRatings: candidateMatchup ? candidateMatchup.scenarioRatings : null
					});
				}

				var threats = counterTeam.map(function(threat){
					var isMeta = metaGroup.some(function(metaPokemon){ return metaPokemon.speciesId == threat.speciesId; });
					return {speciesId: threat.speciesId, speciesName: threat.speciesName, weight: isMeta ? 1.25 : 1};
				});

				if(members.length == 3){
					return CoreSynergyAnalyzer.analyzeCore(members, threats, matchupData);
				}

				return CoreSynergyAnalyzer.analyzePair(members[0], members[1], threats, matchupData);
			};

			this.getAlternativeSynergyScore = function(candidate, threatEntries){
				var score = candidate.matchupAltScore || 0;
				var pressureSum = 0;
				var pressureCount = 0;

				for(var i = 0; i < threatEntries.length; i++){
					var threatEntry = threatEntries[i];
					var altRating = candidate.matchups[i] ? candidate.matchups[i].rating : 0;
					var teamBestAnswer = 0;

					if(threatEntry && threatEntry.matchups){
						var threatRatings = threatEntry.matchups.map(function(matchup){
							return matchup.rating;
						});
						teamBestAnswer = Math.max.apply(null, threatRatings.map(function(value){
							return 1000 - value;
						}));
					}

					var improvement = altRating - teamBestAnswer;
					if(improvement > 0){
						score += improvement * 0.35;
						pressureSum += altRating;
						pressureCount++;
					} else if(altRating < 450){
						score -= 30;
					}
				}

				if(pressureCount > 0){
					var averagePressure = pressureSum / pressureCount;
					if(averagePressure >= 650){
						score += 35;
					} else if(averagePressure < 450){
						score -= 25;
					}
				}

				return score;
			};

			// Display the list of alternative Pokemon given a list of searched Pokemon
			this.displayAlternatives = function(list){
				// Gather advanced settings
				var team = multiSelectors[0].getPokemonList();
				var scorecardCount = parseInt($(".scorecard-length-select option:selected").val());
				var allowShadows = $(".team-option .check.allow-shadows").hasClass("on");
				var allowXL = $(".team-option .check.allow-xl").hasClass("on");
				var baitShields = $(".team-option .check.shield-baiting").hasClass("on");
				var allowSameSpecies = $(".team-option .check.same-species").hasClass("on");

				// Generate counters and histograms, and display that, too
				var shieldMode = $(".team-advanced .flex.poke .shield-select option:selected").val();
				var shieldCount = 1;
				var maxThreatsToShow = Math.min(20, Math.max(10, scorecardCount));

			if(shieldMode != "average" && shieldMode != "all"){
				shieldCount = parseInt(shieldMode);
				shieldMode = "single";
			}

				$(".alternatives-table").html("");
				var $row = $("<thead><tr><td class=\"arrow\"></td></tr></thead>");
				$row.find("tr").append("<th class=\"summary\">Core Score</th>");

				for(var n = 0; n < counterTeam.length; n++){
					$row.find("tr").append("<td class=\"name-small\">"+counterTeam[n].speciesName+"</td>");
				}

				$(".alternatives-table").append($row);
				$(".alternatives-table").append("<tbody></tbody>");

				count = 0;
				total = scorecardCount;
				i = 0;

				// For labyrinth cup, exclude types already on team
				var excludedTypes = [];

				if(battle.getCup().name == "labyrinth"){
					for(var n = 0; n < team.length; n++){
						excludedTypes.push(team[n].types[0]);

						if(team[n].types[1] != "none"){
							excludedTypes.push(team[n].types[1]);
						}
					}
				}

				// Exclude Mega evolutions if one is already on the team
				var hasMega = false;

				for(var n = 0; n < team.length; n++){
					if(team[n].hasTag("mega")){
						hasMega = true;
					}
				}

				// For slot metas, exclude slots that are already filled
				var usedSlots = [];

				if(battle.getCup().slots){
					for(var n = 0; n < team.length; n++){
						let slots = team[n].getSlotNumbers(battle.getCup(), false);

						// Use slots in order
						if(slots.length == 1){
							usedSlots.push(slots[0]);
						} else if(slots.length > 0){
							for(let j = 0; j < slots.length; j++){
								if(! usedSlots.includes(slots[j])){
									usedSlots.push(slots[j]);
									break;
								}
							}
						}
					}
				}

				while((count < total)&&(i < altRankings.length)){
					var r = altRankings[i];

					// Don't exclude alternatives from a custom alternatives list
					if(multiSelectors[2].getPokemonList().length == 0){
						if((r.speciesId.indexOf("_shadow") > -1)&&(! allowShadows)){
							i++
							continue;
						}

						if((r.speciesId.indexOf("_xs") > -1)&&(allowXL)){
							i++;
							continue;
						}

						if((r.pokemon.needsXLCandy())&&(! allowXL)){
							i++;
							continue;
						}


						if(r.pokemon.hasTag("mega") && hasMega){
							i++;
							continue;
						}

						if((! allowSameSpecies) && team.filter(poke => poke.dex == r.pokemon.dex).length > 0){
							i++;
							continue;
						}
					}

					var pokemon = r.pokemon;

					// Filter out Pokemon from search
					if(list && list.indexOf(pokemon.speciesId) == -1){
						i++;
						continue;
					}

					// For Labyrinth Cup, exclude Pokemon of existing types
					if(battle.getCup().name == "labyrinth"){
						if(excludedTypes.indexOf(pokemon.types[0]) > -1 || excludedTypes.indexOf(pokemon.types[1]) > -1){
							i++;
							continue;
						}
					}

					// For slot metas, exclude Pokemon of used slots
					if((battle.getCup().slots)&&(team.length < 6)){
						let slots = pokemon.getSlotNumbers(battle.getCup(), false);

						// If every slot this Pokemon could fill is used, exclude it
						if(slots.every(slot => usedSlots.includes(slot))){
							i++;
							continue;
						}
					}

						// Add results to alternatives table
					var summary = self.getAlternativeSummary(r);
					$row = $("<tr><th class=\"name\"><b>"+(count+1)+". "+pokemon.speciesName+"<div class=\"button add\" pokemon=\""+pokemon.speciesId+"\" alias=\""+pokemon.aliasId+"\">+</div></b></th></tr>");
					$row.append("<td class=\"summary\" title=\""+summary.title+"\"><div class=\"summary-primary\">"+summary.primary+"</div><div class=\"summary-secondary\">"+summary.secondary+"</div></td>");

					for(var n = 0; n < r.matchups.length; n++){
						var $cell = $("<td><a class=\"rating\" href=\"#\" target=\"blank\"><span></span></a></td>");
						var rating = r.matchups[n].rating;

						$cell.find("a").addClass(battle.getRatingClass(rating));

						if(! baitShields){
							pokemon.isCustom = true;
							pokemon.baitShields = 0;
							r.matchups[n].opponent.isCustom = true;
							r.matchups[n].opponent.baitShields = 0;
						}

						var pokeStr = pokemon.generateURLPokeStr();
						var moveStr = pokemon.generateURLMoveStr();
						var opPokeStr = r.matchups[n].opponent.generateURLPokeStr();
						var opMoveStr = r.matchups[n].opponent.generateURLMoveStr();
						var shieldStr = shieldCount + "" + shieldCount;
						var battleLink = host+"battle/"+battle.getCP(true)+"/"+pokeStr+"/"+opPokeStr+"/"+shieldStr+"/"+moveStr+"/"+opMoveStr+"/";
						$cell.find("a").attr("href", battleLink);

						$row.append($cell);
					}

					// Add region for alternative Pokemon for Continentals
					if(battle.getCup().name == "continentals-3"){
						var slotNumber = pokemon.getContinentalSlot();
						var regions = gm.data.pokemonRegions;
						var regionName = regions[slotNumber-1].name;

						$row.find("th.name").append("<div class=\"region-label "+regionName.toLowerCase()+"\">Slot "+ slotNumber + "</div>");
					}

					// Add points for alternative Pokemon for Cliffhanger
					if(battle.getCup().tierRules){
						var tierName = "";
						var pointsName = "points";
						var points = gm.getPokemonTier(pokemon.speciesId, battle.getCup());

						if(points == 1){
							pointsName = "point";
						}

						$row.find("th.name").append("<div class=\"region-label "+tierName.toLowerCase()+"\">"+points+" "+pointsName+"</div>");
					}

					// Add slot label for slot metas
					if(battle.getCup().slots){
						var tierName = "";
						var slot = 0;

						let slots = pokemon.getSlotNumbers(battle.getCup());

						if(slots.length > 0){
							$row.find("th.name").append("<div class=\"region-label\">Slot "+slots.join(", ")+"</div>");
						}

					}

					$(".alternatives-table tbody").append($row);

					i++;
					count++;
				}

				// Center search with the table
				$(".poke-search[context='alternative-search']").parent().css("max-width", $(".alternatives-table").width());
				$(".poke-search[context='alternative-search']").parent().css("margin", "0 auto");

				if(multiSelectors[0].getAvailableSpots() <= 0){
					$(".alternatives-table .button.add").hide();
				}
			}

			// Given a subject type, produce effectiveness array for offense or defense

			this.getTypeEffectivenessArray = function(subjectTypes, direction){
				var arr = [];

				var allTypes = Pokemon.getAllTypes();

				for(var n = 0; n < allTypes.length; n++){

					if(direction == "offense"){
						var effectiveness = DamageCalculator.getEffectiveness(subjectTypes[0], [allTypes[n]]);

						// Round to nearest thousandths to avoid Javascript floating point wonkiness

						effectiveness = Math.floor(effectiveness * 1000) / 1000;

						arr.push(effectiveness);
					} else if(direction == "defense"){
						effectiveness = DamageCalculator.getEffectiveness(allTypes[n], subjectTypes);

						// Round to nearest thousandths to avoid Javascript floating point wonkiness

						effectiveness = Math.floor(effectiveness * 1000) / 1000;

						arr.push(effectiveness);
					}
				}

				return arr;
			}

			this.displayArray = function(arr, direction){
				$(".typings ."+direction).html('');

				// Yes, actually using the <table> tag for its intended function

				var $table = $("<table></table>");

				// Output header row of all types

				var allTypes = Pokemon.getAllTypes();
				var $tr = $("<tr><td></td></tr>");

				for(var i = 0; i < allTypes.length; i++){
					$tr.append("<td class=\""+allTypes[i].toLowerCase()+" heading\">"+allTypes[i]+"</td>");
				}

				$table.append($tr);

				// Output row for each item in arr

				for(var i = 0; i < arr.length; i++){

					$tr = $("<tr></tr>");

					$tr.append("<td class=\""+arr[i].type+" name heading\">"+arr[i].name+"</td>");

					for(var n = 0; n < arr[i].matchups.length; n++){

						var number = arr[i].matchups[n];
						var colors = ['81, 251, 35', '251, 35, 81'];
						var colorIndex = 0;
						var opacity = 0;

						// Display green for resistance and effective moves, red for weaknesses and ineffective moves

						if(direction == "defense"){
							if(number < 1){
								colorIndex = 0;
								opacity = .244 / number;
							} else if(number > 1){
								colorIndex = 1;
								opacity = number / 2.65;
							}
						} else if(direction == "offense"){
							if(number < 1){
								colorIndex = 1;
								opacity = .39 / number;
							} else if(number > 1){
								colorIndex = 0;
								opacity = number / 1.6;
							}
						}

						$tr.append("<td style=\"background:rgba("+colors[colorIndex]+","+opacity+")\">"+arr[i].matchups[n]+"</td>");
					}

					$table.append($tr);
				}

				$(".typings ."+direction).append($table);
			}

			// Given arrays for defensive and offensive effectiveness, produce a written summary

			this.generateSummaries = function(defenseArr, offenseArr){

				$(".summary").html('');

				// Defensive Summary

				var defenseSumArr = []; // Array of string items

				defenseSumArr = this.generateTypeSummary(defenseArr, defenseSumArr, "defense");

				var $defenseList = $("<ul></ul>");

				for(var i = 0; i < defenseSumArr.length; i++){
					$defenseList.append("<li>"+defenseSumArr[i]+"</li>");
				}

				$(".defense-summary").append($defenseList);

				// Offensive Summary

				var offenseSumArr = []; // Array of string items

				offenseSumArr = this.generateTypeSummary(offenseArr, offenseSumArr, "offense");

				var $offenseList = $("<ul></ul>");

				for(var i = 0; i < offenseSumArr.length; i++){
					$offenseList.append("<li>"+offenseSumArr[i]+"</li>");
				}

				$(".offense-summary").append($offenseList);
			}

			// Return an array of descriptions given an array of type effectiveness, and a flag for offense or defense

			this.generateTypeSummary = function(arr, sumArr, direction){
				var typesResistedArr = [];
				var typesWeakArr = [];
				var typesNeutralOrBetter = []; // Array of types that can be hit for neutral damage or better
				var productArr = []; // Product of resistances across all Pokemon

				var allTypes = Pokemon.getAllTypes();

				for(var i = 0; i < allTypes.length; i++){
					typesResistedArr.push(0);
					typesWeakArr.push(0);
					typesNeutralOrBetter.push(0);
					productArr.push(1);
				}

				for(var i = 0; i < arr.length; i++){
					var obj = arr[i];

					for(var n = 0; n < obj.matchups.length; n++){

						if(obj.matchups[n] < 1){
							typesResistedArr[n] = 1;
						} else if (obj.matchups[n] > 1){
							typesWeakArr[n] = 1;
						}

						if(obj.matchups[n] >= 1){
							typesNeutralOrBetter[n] = 1;
						}

						productArr[n] *= obj.matchups[n];
					}
				}
				// Produce a final defensive count

				var typesResisted = 0;
				var typesWeak = 0;
				var overallStrengths = [];
				var overallWeaknesses = [];
				var overallNoNeutralDamage = [];

				for(var i = 0; i < allTypes.length; i++){
					if(typesResistedArr[i] == 1){
						typesResisted++;
					}

					if(typesWeakArr[i] == 1){
						typesWeak++;
					}

					if(typesNeutralOrBetter[i] == 0){
						overallNoNeutralDamage.push(allTypes[i]);
					}

					if(productArr[i] < 1){
						overallStrengths.push(allTypes[i]);
					} else if(productArr[i] > 1){
						overallWeaknesses.push(allTypes[i]);
					}
				}

				if(direction == "defense"){
					sumArr.push("This team resists " + typesResisted + " of " + allTypes.length + " types.");
					sumArr.push("This team is weak to " + typesWeak + " of " + allTypes.length + " types.");
				} else if(direction == "offense"){
					sumArr.push("This team can hit " + typesWeak + " of " + allTypes.length + " types super effectively.");
				}

				var str;

				// On defense show which types are best resisted, and on offense show which types are best hit effectively

				if(overallStrengths.length > 0){
					if(direction=="defense"){
						str = this.generateTypeSummaryList(overallStrengths, "Overall, strong against","");
					} else if(direction=="offense"){
						str = this.generateTypeSummaryList(overallWeaknesses, "Overall, most effective against","");
					}

					sumArr.push(str);
				}

				// On defense, show list of types that hit this team most effectively

				if((overallWeaknesses.length > 0) && (direction == "defense")){
					str = this.generateTypeSummaryList(overallWeaknesses, "Overall, weak to","");

					sumArr.push(str);
				}

				// On offense, show list of types that can't be hit with neutral or better damage

				if((overallNoNeutralDamage.length > 0) && (direction == "offense")){
					str = this.generateTypeSummaryList(overallNoNeutralDamage, "This team can't hit", " for at least neutral damage.");

					sumArr.push(str);
				}

				return sumArr;
			}

			// Generate and return a descriptive string given a list of types

			this.generateTypeSummaryList = function(arr, beforeStr, afterStr){

				var str = beforeStr;

				for(var i = 0; i < arr.length; i++){
					if(i > 0){
						str += ",";

						if((i == arr.length - 1) && (i > 1)){
							str += " and";
						}
					}

					str += " <span class=\"" + arr[i].toLowerCase() + "\">" + arr[i] + "</span>";
				}

				str += afterStr;

				return str;
			}

			// Event handler for changing the cup select

			function selectFormat(e){
				var cp = $(".format-select option:selected").val();
				var cup = $(".format-select option:selected").attr("cup");

				battle.setCP(cp);
				battle.setCup(cup);

				var levelCap = 50;

				if(battle.getCup().levelCap){
					levelCap = battle.getCup().levelCap;
				}

				battle.setLevelCap(levelCap);

				// Set the selected team to the new CP
				for(var i = 0; i < multiSelectors.length; i++){
					multiSelectors[i].setCP(cp);
					multiSelectors[i].setLevelCap(levelCap);
				}

				if(battle.getCup().tierRules){
					multiSelectors[0].setCliffhangerMode(true);
				} else{
					multiSelectors[0].setCliffhangerMode(false);
				}

				if(battle.getCup().partySize == 8){
					$(".team-size-select option[value=8]").prop("selected", "selected");
					$(".team-size-select").trigger("change");
				}

				if(battle.getCup().allowSameSpecies){
					$(".check.same-species").addClass("on");
				}

				// Load ranking data for movesets
				var key = battle.getCup().name + "overall" + battle.getCP();

				if(! gm.rankings[key]){
					gm.loadRankingData(self, "overall", battle.getCP(), battle.getCup().name);
				}
			}

			// Event handler for clicking the rate button

			function rateClick(e){
				$(".rate-btn .btn-label").html("Generating...");
				$(".section.error").hide();
				$(".team-advanced").prev(".toggle").removeClass("active"); // Hide advanced options when generating results

				// This is stupid but the visual updates won't execute until Javascript has completed the entire thread

				setTimeout(function(){
					var results = self.updateTeamResults();

					// Set new page state
					var cp = battle.getCP(true);
					var cup = battle.getCup().name;

					var pokes = multiSelectors[0].getPokemonList();
					var teamStr = "team-builder/"+cup+"/"+cp+"/";
					teamStr += encodeURIComponent(multiSelectors[0].generateURLMoveStr());


					// Add move strings to URL

					var link = host + teamStr;

					$(".share-link input").val(link);

					// Push state to browser history so it can be navigated, only if not from URL parameters

					if(get){

						var sameTeam = true;

						for(var i = 0; i < pokes.length; i++){
							if(get["p"+(i+1)] != pokes[i].speciesId){
								sameTeam = false;
							}
						}

						if(get["cup"] != cup){
							sameTeam = false;
						}

						if(sameTeam){
							return;
						}
					}

					var url = webRoot+teamStr;
					var data = {cup: cup, cp: cp + "", t: multiSelectors[0].generateURLMoveStr()};

					window.history.pushState(data, "Team Builder", url);

					// Send Google Analytics pageview
					var teamNameStr = pokes[0].speciesName;
					var i = 1;

					for(i = 1; i < Math.min(pokes.length, 3); i++){
						teamNameStr += ", " + pokes[i].speciesName;
					}

					if(i < pokes.length){
						teamNameStr += "+" + (pokes.length - i);
					}

					gtag('event', 'page_view', {
					  page_title: teamNameStr + " - Team Builder | PvPoke",
					  page_location: link,
					  pageview_type: 'virtual'
					});

					if(results === false){
						return;
					}

					$(".rate-btn .btn-label").html("Rate Team");

					// Scroll down to results

					$("html, body").animate({ scrollTop: $(".section.typings a").first().offset().top }, 500);

					},
				10);

			}

			// Add a Pokemon from the alternatives table

			function addAlternativePokemon(e){
				var id = $(e.target).attr("pokemon");

				// Use an alias ID if it exists
				if($(e.target).attr("alias") != $(e.target).attr("pokemon")){
					id = $(e.target).attr("alias");
				}

				$(".poke-select-container .poke.multi .add-poke-btn").trigger("click", false);

				let pokeSelector = multiSelectors[0].getPokeSelector();
				pokeSelector.setPokemon(id);

				$("html, body").animate({ scrollTop: $(".poke.multi").offset().top }, 500);

				// Use alias default moveset if it exists
				if($(e.target).attr("alias") != $(e.target).attr("pokemon")){
					var pokemon = new Pokemon($(e.target).attr("pokemon"), 0, battle);
					pokemon.initialize(true);
					pokemon.selectRecommendedMoveset();

					$(".modal .move-select.fast option[value=\""+pokemon.fastMove.moveId+"\"]").prop("selected", "selected");
					$(".modal .move-select.fast").trigger("change");

					$(".modal .move-select.charged").eq(0).find("option[value=\""+pokemon.chargedMoves[0].moveId+"\"]").prop("selected", "selected");
					$(".modal .move-select.charged").eq(0).trigger("change");

					$(".modal .move-select.charged").eq(1).find("option[value=\""+pokemon.chargedMoves[1].moveId+"\"]").prop("selected", "selected");
					$(".modal .move-select.charged").eq(1).trigger("change");
				}
			}

			function selectCoreRecommendation(e){
				if($(e.target).closest(".core-card-add").length){
					return;
				}
				var speciesId = $(e.currentTarget).attr("data-species-id");
				var ranking = altRankings.find(function(entry){ return entry.speciesId == speciesId; });
				if(ranking){
					self.showCoreRecommendation(ranking);
					$(".core-recommendation-card").removeClass("selected");
					$(e.currentTarget).addClass("selected");
				}
			}

			function addCoreRecommendation(e){
				e.preventDefault();
				e.stopPropagation();
				addAlternativePokemon(e);
				setTimeout(function(){
					$(".modal .save-poke").trigger("click");
				}, 0);
			}

			// Open the print dialogue

			function printScorecard(e){
				e.preventDefault();

				$("body").addClass("scorecard-print");

				window.print();
			}

			// Turn checkboxes on and off

			function checkBox(e){
				$(this).toggleClass("on");
				$(this).trigger("change");
			}

			// Change the maximum team size in the advanced settings

			function selectTeamSize(e){
				multiSelectors[0].setMaxPokemonCount($(e.target).find("option:selected").val());
			}
		};

        return object;
    }

    return {
        getInstance: function () {
            if (!instance) {
                instance = createInstance();
            }
            return instance;
        }
    };
})();
