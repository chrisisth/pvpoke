var CoreSynergyAnalyzer = (function () {
    var allTypes = null;

    function clamp(value, min, max){
        return Math.max(min, Math.min(max, value));
    }

    function average(values){
        if(values.length == 0){
            return 0;
        }
        return values.reduce(function(sum, value){ return sum + value; }, 0) / values.length;
    }

    function weightedAverage(values){
        var totalWeight = 0;
        var total = 0;

        values.forEach(function(item){
            var weight = item.weight || 1;
            total += item.value * weight;
            totalWeight += weight;
        });

        return totalWeight ? total / totalWeight : 0;
    }

    function quantile(values, percentile){
        if(! values.length){
            return 0;
        }
        var sorted = values.slice().sort(function(a, b){ return a - b; });
        var index = Math.max(0, Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * percentile)));
        return sorted[index];
    }

    function ratingValue(matchup){
        if(! matchup){
            return 0;
        }
        return typeof matchup == "number" ? matchup : matchup.rating;
    }

    function scenarioVolatility(matchup){
        if(! matchup || ! matchup.scenarioRatings || matchup.scenarioRatings.length < 2){
            return 0;
        }
        return Math.max.apply(null, matchup.scenarioRatings) - Math.min.apply(null, matchup.scenarioRatings);
    }

    function robustRating(matchup){
        if(! matchup){
            return 0;
        }

        var rating = ratingValue(matchup);
        var scenarios = matchup.scenarioRatings || [];
        var scenarioAverage = scenarios.length ? average(scenarios) : rating;
        var worst = scenarios.length ? Math.min.apply(null, scenarios) : rating;

        return clamp((rating * 0.5) + (scenarioAverage * 0.2) + (worst * 0.3), 0, 1000);
    }

    function getTypes(){
        if(! allTypes){
            allTypes = Pokemon.getAllTypes();
        }
        return allTypes;
    }

    function getTypingProfile(pokemon){
        var weaknesses = [];
        var resistances = [];
        var immunities = [];

        getTypes().forEach(function(type){
            var effectiveness = DamageCalculator.getEffectiveness(type, pokemon.types);
            if(effectiveness > 1){
                weaknesses.push(type);
            } else if(effectiveness < 0.5){
                immunities.push(type);
            } else if(effectiveness < 1){
                resistances.push(type);
            }
        });

        return {
            weaknesses: weaknesses,
            resistances: resistances,
            immunities: immunities
        };
    }

    function getMoveCoverage(pokemon){
        var moves = [];
        if(pokemon.fastMove){
            moves.push(pokemon.fastMove);
        }
        (pokemon.chargedMoves || []).forEach(function(move){
            if(move){
                moves.push(move);
            }
        });

        var coveredTypes = [];
        moves.forEach(function(move){
            getTypes().forEach(function(type){
                if(DamageCalculator.getEffectiveness(move.type, [type]) >= 1 && coveredTypes.indexOf(type) == -1){
                    coveredTypes.push(type);
                }
            });
        });

        return {
            types: moves.map(function(move){ return move.type; }).filter(function(type, index, arr){ return arr.indexOf(type) == index; }),
            coveredTypes: coveredTypes
        };
    }

    function getMoveProfile(pokemon){
        var fastMove = pokemon.fastMove;
        var chargedMoves = (pokemon.chargedMoves || []).filter(function(move){ return !!move; });
        var moveCoverage = getMoveCoverage(pokemon);
        var fastPressure = 0;
        var energyGeneration = 0;
        var chargedQuality = 0;
        var shieldPressure = 0;

        if(fastMove){
            fastPressure = clamp(((fastMove.power || 0) * (fastMove.stab || 1)) / Math.max(fastMove.cooldown || 500, 500) * 500, 0, 100);
            energyGeneration = clamp((fastMove.energyGain || 0) / Math.max(fastMove.cooldown || 500, 500) * 500, 0, 100);
        }

        if(chargedMoves.length){
            chargedQuality = clamp(average(chargedMoves.map(function(move){
                return ((move.power || move.damage || 0) * (move.stab || 1)) / Math.max(move.energy || 100, 1) * 100;
            })), 0, 100);
            shieldPressure = clamp(average(chargedMoves.map(function(move){
                return (1 - Math.min((move.energy || 100) / 100, 1)) * 100;
            })), 0, 100);
        }

        return {
            fastMovePressure: fastPressure,
            energyGeneration: energyGeneration,
            chargedMoveQuality: chargedQuality,
            shieldPressure: shieldPressure,
            neutralCoverage: moveCoverage.coveredTypes.length / getTypes().length * 100,
            moveTypes: moveCoverage.types,
            coveredTypes: moveCoverage.coveredTypes
        };
    }

    function createPokemonProfile(pokemon, matchups, threatWeights){
        var matchupByThreat = {};
        (matchups || []).forEach(function(entry, index){
            var threatId = entry.threatId || entry.speciesId || (entry.opponent && entry.opponent.speciesId) || String(index);
            matchupByThreat[threatId] = {
                rating: ratingValue(entry),
                scenarioRatings: entry.scenarioRatings || null,
                robustRating: robustRating(entry),
                scenarioVolatility: scenarioVolatility(entry),
                baitDependence: null
            };
        });

        var statProduct = pokemon.stats.atk * pokemon.stats.def * pokemon.stats.hp;

        return {
            speciesId: pokemon.speciesId,
            speciesName: pokemon.speciesName,
            types: pokemon.types,
            pokemon: pokemon,
            stats: {
                atk: pokemon.stats.atk,
                def: pokemon.stats.def,
                hp: pokemon.stats.hp,
                statProduct: statProduct
            },
            typingProfile: getTypingProfile(pokemon),
            moveProfile: getMoveProfile(pokemon),
            matchupProfile: {
                robustRatingByThreat: matchupByThreat,
                worstRatingByThreat: Object.keys(matchupByThreat).reduce(function(result, key){ result[key] = matchupByThreat[key].scenarioRatings ? Math.min.apply(null, matchupByThreat[key].scenarioRatings) : matchupByThreat[key].rating; return result; }, {}),
                scenarioVolatilityByThreat: Object.keys(matchupByThreat).reduce(function(result, key){ result[key] = matchupByThreat[key].scenarioVolatility; return result; }, {}),
                baitDependenceByThreat: Object.keys(matchupByThreat).reduce(function(result, key){ result[key] = null; return result; }, {})
            },
            threatWeights: threatWeights || {}
        };
    }

    function getMatchup(profile, threatId){
        return profile.matchupProfile.robustRatingByThreat[threatId] || {robustRating: 0, rating: 0, scenarioVolatility: 0};
    }

    function normalizedThreats(threats){
        return (threats || []).map(function(threat){
            return {
                id: threat.speciesId || threat.id,
                weight: threat.weight || 1,
                label: threat.speciesName || threat.name || threat.speciesId || threat.id
            };
        });
    }

    function defensiveComplementarity(profileA, profileB){
        var values = [];
        getTypes().forEach(function(type){
            var effectivenessA = DamageCalculator.getEffectiveness(type, profileA.types);
            var effectivenessB = DamageCalculator.getEffectiveness(type, profileB.types);
            var compensation = 0;

            if(effectivenessA > 1 && effectivenessB < 1){
                compensation = clamp((effectivenessA - 1) * (1 - effectivenessB), 0, 2);
            } else if(effectivenessB > 1 && effectivenessA < 1){
                compensation = clamp((effectivenessB - 1) * (1 - effectivenessA), 0, 2);
            }

            values.push(compensation / 2 * 100);
        });
        return average(values);
    }

    function resistanceComplementarity(profileA, profileB){
        var values = [];
        getTypes().forEach(function(type){
            var a = DamageCalculator.getEffectiveness(type, profileA.types);
            var b = DamageCalculator.getEffectiveness(type, profileB.types);
            if((a > 1 && b < 1) || (b > 1 && a < 1)){
                values.push(clamp(1 - Math.min(a, b), 0, 1) * 100);
            }
        });
        return values.length ? average(values) : 0;
    }

    function coverageOverlap(profileA, profileB){
        var union = profileA.moveProfile.coveredTypes.concat(profileB.moveProfile.coveredTypes).filter(function(type, index, arr){ return arr.indexOf(type) == index; });
        var intersection = profileA.moveProfile.coveredTypes.filter(function(type){ return profileB.moveProfile.coveredTypes.indexOf(type) > -1; });
        return union.length ? intersection.length / union.length * 100 : 0;
    }

    function offensiveCoverage(profileA, profileB){
        var union = profileA.moveProfile.coveredTypes.concat(profileB.moveProfile.coveredTypes).filter(function(type, index, arr){ return arr.indexOf(type) == index; });
        return union.length / getTypes().length * 100;
    }

    function roleComplementarity(profileA, profileB){
        var values = [
            Math.abs(profileA.moveProfile.fastMovePressure - profileB.moveProfile.fastMovePressure),
            Math.abs(profileA.moveProfile.energyGeneration - profileB.moveProfile.energyGeneration),
            Math.abs(profileA.moveProfile.shieldPressure - profileB.moveProfile.shieldPressure)
        ];
        return 100 - average(values);
    }

    function analyzePair(pokemonA, pokemonB, threats, matchupData){
        var threatList = normalizedThreats(threats);
        var profileA = createPokemonProfile(pokemonA, matchupData && matchupData[pokemonA.speciesId], {});
        var profileB = createPokemonProfile(pokemonB, matchupData && matchupData[pokemonB.speciesId], {});
        var coverageValues = [];
        var consistencyValues = [];
        var redundancyValues = [];
        var sharedWeaknessValues = [];
        var breakerValues = [];
        var coverageReasons = [];
        var sharedWeaknesses = [];
        var coreBreakers = [];

        threatList.forEach(function(threat){
            var a = getMatchup(profileA, threat.id);
            var b = getMatchup(profileB, threat.id);
            var best = Math.max(a.robustRating, b.robustRating);
            var aRating = a.robustRating;
            var bRating = b.robustRating;
            var bothWeak = aRating < 400 && bRating < 400;
            var bothUncertain = aRating < 500 && bRating < 500;

            coverageValues.push({value: best / 10, weight: threat.weight});
            consistencyValues.push({value: clamp(100 - Math.max(a.scenarioVolatility, b.scenarioVolatility) / 10, 0, 100), weight: threat.weight});
            redundancyValues.push({value: aRating >= 600 && bRating >= 600 ? 100 : 0, weight: threat.weight});
            sharedWeaknessValues.push({value: bothWeak ? 100 : bothUncertain ? 45 : 0, weight: threat.weight});
            breakerValues.push({value: bothWeak ? 100 : bothUncertain ? 50 : 0, weight: threat.weight});

            if(best >= 600){
                coverageReasons.push(threat.label);
            }
            if(bothWeak){
                sharedWeaknesses.push(threat.label);
                coreBreakers.push({name: threat.label, severity: "hard", ratingA: aRating, ratingB: bRating});
            } else if(bothUncertain){
                coreBreakers.push({name: threat.label, severity: "soft", ratingA: aRating, ratingB: bRating});
            }
        });

        var threatCoverage = weightedAverage(coverageValues);
        var coreConsistency = weightedAverage(consistencyValues);
        var weaknessCompensation = defensiveComplementarity(profileA, profileB);
        var resistanceScore = resistanceComplementarity(profileA, profileB);
        var redundancyScore = (weightedAverage(redundancyValues) + coverageOverlap(profileA, profileB)) / 2;
        var score = 0.25 * threatCoverage
            + 0.20 * weaknessCompensation
            + 0.15 * resistanceScore
            + 0.15 * offensiveCoverage(profileA, profileB)
            + 0.10 * coreConsistency
            + 0.05 * roleComplementarity(profileA, profileB)
            - 0.05 * redundancyScore
            - 0.10 * weightedAverage(sharedWeaknessValues)
            - 0.10 * weightedAverage(breakerValues);

        return {
            pokemonA: pokemonA.speciesId,
            pokemonB: pokemonB.speciesId,
            profiles: {a: profileA, b: profileB},
            defensiveSynergy: defensiveComplementarity(profileA, profileB),
            weaknessCompensation: weaknessCompensation,
            resistanceComplementarity: resistanceScore,
            offensiveCoverage: offensiveCoverage(profileA, profileB),
            threatCoverage: threatCoverage,
            coreConsistency: coreConsistency,
            coverageRedundancy: redundancyScore,
            sharedWeaknessPenalty: weightedAverage(sharedWeaknessValues),
            coreBreakerPenalty: weightedAverage(breakerValues),
            scenarioVolatility: 100 - coreConsistency,
            sharedWeaknesses: sharedWeaknesses,
            coreBreakers: coreBreakers,
            pairScore: clamp(score, 0, 100),
            explanation: {
                coveredThreats: coverageReasons,
                sharedWeaknesses: sharedWeaknesses,
                coreBreakers: coreBreakers
            }
        };
    }

    function evaluateLineOrder(members, threats, matchupData, order){
        var lead = members[order[0]];
        var safe = members[order[1]];
        var closer = members[order[2]];
        var leadData = matchupData[lead.speciesId] || [];
        var safeData = matchupData[safe.speciesId] || [];
        var closerData = matchupData[closer.speciesId] || [];
        var findAverage = function(data){ return weightedAverage((data || []).map(function(entry){ return {value: robustRating(entry) / 10, weight: 1}; })); };
        var findSafe = function(data){
            if(! data || ! data.length){
                return 0;
            }
            var ratings = data.map(robustRating);
            return (average(ratings) * 0.4 + quantile(ratings, 0.25) * 0.6) / 10;
        };
        var findCloser = function(data){ return data && data.length ? data.filter(function(entry){ return robustRating(entry) >= 600; }).length / data.length * 100 : 0; };
        var lineScore = findAverage(leadData) * 0.35 + findSafe(safeData) * 0.30 + findCloser(closerData) * 0.20 + findAverage(closerData) * 0.15;

        return {
            order: order,
            names: [lead.speciesName, safe.speciesName, closer.speciesName],
            leadScore: findAverage(leadData),
            safeSwitchScore: findSafe(safeData),
            closerScore: findCloser(closerData),
            lineScore: clamp(lineScore, 0, 100)
        };
    }

    function analyzeCore(members, threats, matchupData){
        if(! members || members.length != 3){
            return null;
        }

        var pairAB = analyzePair(members[0], members[1], threats, matchupData);
        var pairAC = analyzePair(members[0], members[2], threats, matchupData);
        var pairBC = analyzePair(members[1], members[2], threats, matchupData);
        var threatList = normalizedThreats(threats);
        var coverage = [];
        var criticalGaps = [];
        var coreBreakers = [];
        var threatAnalysis = [];

        threatList.forEach(function(threat){
            var ratings = members.map(function(member){ return getMatchup(createPokemonProfile(member, matchupData[member.speciesId], {}), threat.id).robustRating; });
            var best = Math.max.apply(null, ratings);
            coverage.push({value: best / 10, weight: threat.weight});
            threatAnalysis.push({
                threat: threat.label,
                weight: threat.weight,
                ratings: ratings,
                bestRating: best,
                status: best >= 600 ? "covered" : (best >= 500 ? "partial" : (best >= 400 ? "uncertain" : "uncovered"))
            });
            if(best < 400){
                criticalGaps.push({name: threat.label, rating: best, severity: "hard"});
                coreBreakers.push(threat.label);
            } else if(best < 500){
                criticalGaps.push({name: threat.label, rating: best, severity: "soft"});
            }
        });

        var orders = [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]].map(function(order){
            return evaluateLineOrder(members, threats, matchupData, order);
        }).sort(function(a,b){ return b.lineScore - a.lineScore; });
        var viableLineCount = orders.filter(function(order){ return order.lineScore >= 45; }).length;
        var lineFlexibility = average(orders.map(function(order){ return order.lineScore; }));
        var orderDependency = 100 - (viableLineCount / orders.length * 100);
        var trioCoverage = weightedAverage(coverage);
        var marginalCoverage = Math.max(0, trioCoverage - pairAB.threatCoverage);
        var pairSupport = (pairAB.pairScore + pairAC.pairScore + pairBC.pairScore) / 3;
            var candidatePairSupport = (pairAC.pairScore + pairBC.pairScore) / 2;
        var criticalPenalty = threatList.length ? (criticalGaps.reduce(function(total, gap){ return total + (gap.severity == "hard" ? 1 : 0.5); }, 0) / threatList.length) * 100 : 0;
        var coreScore = clamp(
            trioCoverage * 0.25
            + marginalCoverage * 0.20
            + pairSupport * 0.25
            + lineFlexibility * 0.15
            + (100 - criticalPenalty) * 0.15,
            0,
            100
        );

        return {
            members: members.map(function(member){ return member.speciesId; }),
            pairAB: pairAB,
            pairAC: pairAC,
            pairBC: pairBC,
            threatCoverage: trioCoverage,
            marginalCoverage: marginalCoverage,
            candidatePairSupport: candidatePairSupport,
            existingPairScore: pairAB.pairScore,
            pairSupport: pairSupport,
            threatAnalysis: threatAnalysis,
            criticalGaps: criticalGaps,
            existingPairWeaknesses: pairAB.sharedWeaknesses,
            candidatePairWeaknesses: pairAC.sharedWeaknesses.concat(pairBC.sharedWeaknesses).filter(function(name, index, arr){ return arr.indexOf(name) == index; }),
            coreBreakers: coreBreakers,
            sharedWeaknesses: pairAB.sharedWeaknesses.concat(pairAC.sharedWeaknesses, pairBC.sharedWeaknesses).filter(function(name, index, arr){ return arr.indexOf(name) == index; }),
            roleFlexibility: lineFlexibility,
            lineOrders: orders,
            bestLine: orders[0] || null,
            viableLineCount: viableLineCount,
            lineFlexibility: lineFlexibility,
            orderDependency: orderDependency,
            coreScore: coreScore,
            explanation: {
                strengths: [
                    "Threat coverage: " + Math.round(trioCoverage),
                    "Viable line orders: " + viableLineCount + "/6"
                ],
                weaknesses: criticalGaps.map(function(gap){ return gap.severity + " gap vs " + gap.name; })
            }
        };
    }

    return {
        createPokemonProfile: createPokemonProfile,
        getRobustMatchupRating: robustRating,
        getScenarioVolatility: scenarioVolatility,
        analyzePair: analyzePair,
        analyzeCore: analyzeCore,
        debugCore: analyzeCore
    };
})();
