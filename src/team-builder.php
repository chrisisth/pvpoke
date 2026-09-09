<?php

$META_TITLE = 'Team Builder';

$META_DESCRIPTION = 'Build your team for Pokemon GO Trainer Battles. See how your Pokemon match up offensively and defensively, discover which Pokemon are the best counters to yours, and get suggestions for how to make your team better.';

$CANONICAL = '/team-builder/';

require_once 'header.php';

?>

<h1>Team Builder</h1>

<div class="section league-select-container team-content white">
	<p>Select your Pokemon and movesets below. You'll see how your team matches up against top Pokemon, which Pokemon pose a potential threat, and potential alternatives for your team. You can also use this tool to identify strong team cores and how to break them.</p>
	<?php require 'modules/formatselect.php'; ?>

	<a class="toggle" href="#">Advanced <span class="arrow-down">&#9660;</span><span class="arrow-up">&#9650;</span></a>
	<div class="toggle-content team-advanced">
		<h3 class="section-title">Options</h3>
		<div class="flex poke">
			<div class="team-option">
				<h3>Max Team Size</h3>
				<select class="team-size-select">
					<option value="3" selected>3</option>
					<option value="6">6</option>
					<option value="8">8</option>
					<option value="10">10</option>
					<option value="12">12</option>
					<option value="15">15</option>
					<option value="20">20</option>
					<option value="30">30</option>
					<option value="40">40</option>
					<option value="60">60</option>
					<option value="80">80</option>
					<option value="100">100</option>
					<option value="200">200</option>
				</select>
			</div>
			<div class="team-option">
				<h3>Scorecard Length</h3>
				<select class="scorecard-length-select">
					<option value="10">10</option>
					<option value="20" selected>20</option>
					<option value="30">30</option>
					<option value="40">40</option>
					<option value="60">60</option>
					<option value="80">80</option>
					<option value="100">100</option>
					<option value="200">200</option>
					<option value="300">300</option>
					<option value="400">400</option>
					<option value="500">500</option>
					<option value="1000">1000</option>
					<option value="2000">2000</option>					
				</select>
			</div>
			<div class="team-option">
				<h3>Shadow Pokemon</h3>
				<div class="check on allow-shadows"><span></span>Show Shadow Pokemon in results</div>
			</div>
			<div class="team-option">
				<h3>Prioritize Meta</h3>
				<div class="check on prioritize-meta"><span></span>Prioritize meta threats and alternatives</div>
			</div>
			<div class="team-option">
				<h3>Recommend XL Pokemon</h3>
				<div class="check allow-xl <?php if($_SETTINGS->xls): echo "on"; endif; ?>"><span></span>Show Pokemon above level 40 in threats and alternatives</div>
			</div>
			<div class="team-option">
				<h3>Allow Same Species</h3>
				<div class="check same-species"><span></span>Allow team to use multiple of the same species</div>
			</div>
			<div class="flex-break"></div>
			<div class="team-option">
				<h3>Shields</h3>
				<select class="shield-select">
					<option value="average" selected>Average (0 & 1)</option>
					<option value="all">All combinations (0–2 each)</option>
					<option value="0">No shields</option>
					<option value="1">1 shield</option>
					<option value="2">2 shields</option>
				</select>
			</div>
			<div class="team-option">
				<h3>Shield Baiting</h3>
				<div class="check shield-baiting on"><span></span>Bait shields with low-energy moves</div>
			</div>
		</div>
		<p>Note that links will not currently preserve these advanced settings.</p>
		<div class="flex">
			<div class="flex-section">
				<h3 class="section-title">Custom Threats</h3>
				<p>Enter a custom group of Pokemon to evaluate threats. These Pokemon will also make up the meta scorecard.</p>
				<div class="team-build custom-threats">
					<?php require 'modules/pokemultiselect.php'; ?>
				</div>
			</div>
			<div class="flex-section">
				<h3 class="section-title">Custom Alternatives</h3>
				<p>Enter a custom group of Pokemon to evaluate alternatives. These will appear as suggestions for your team.</p>
				<div class="team-build custom-alternatives">
					<?php require 'modules/pokemultiselect.php'; ?>
				</div>
			</div>
			<div class="flex-section">
				<h3 class="section-title">Exclude Threats</h3>
				<p>Exclude these Pokemon from the list of threats.</p>
				<div class="team-build exclude-threats">
					<?php require 'modules/pokemultiselect.php'; ?>
				</div>
			</div>
			<div class="flex-section">
				<h3 class="section-title">Exclude Alternatives</h3>
				<p>Exclude these Pokemon from your suggested alternatives.</p>
				<div class="team-build exclude-alternatives">
					<?php require 'modules/pokemultiselect.php'; ?>
				</div>
			</div>
		</div>
	</div>
</div>

<div class="section team-build team poke-select-container">
	<?php require 'modules/pokemultiselect.php'; ?>
</div>

<button class="rate-btn button">
	<span class="btn-content-wrap">
		<span class="btn-icon btn-icon-team"></span>
		<span class="btn-label">Rate Team</span>
	</span>
</button>

<div class="section white error">Please select one or more Pokemon.</div>

<div class="section typings white">
	<a href="#" class="toggle active">Overview <span class="arrow-down">&#9660;</span><span class="arrow-up">&#9650;</span></a>
	<div class="toggle-content article">
		<p class="overview-intro">A compact view of the team's roles, coverage gaps, and strongest third-pokemon options.</p>
		<div class="overview-section core-recommendations">
			<div class="flex">
				<h3>Recommended Third Pokemon</h3>
				<div class="core-recommendation-meta"></div>
			</div>
			<p class="core-recommendation-intro">Ranked by added coverage and compatibility with the selected duo.</p>
			<div class="core-recommendation-list"></div>
			<div class="core-detail-panel" aria-live="polite"></div>
		</div>
	</div>
	<a href="#" class="toggle active">Meta Scorecard <span class="arrow-down">&#9660;</span><span class="arrow-up">&#9650;</span></a>
	<div class="toggle-content article">
		<p>Explore how the top ranked Pokemon match up against your team below. Print this scorecard or save a screenshot for reference as you practice. Remember to prepare beforehand and follow timely play in tournaments!</p>
		<div class="table-container">
			<table class="meta-table rating-table" cellspacing="0"></table>
		</div>
		<div class="results-buttons">
			<a href="#" class="button print-scorecard">Print</a>
			<a href="#" class="button download-csv">Export All Matchups to CSV</a>
		</div>
	</div>

	<a href="#" class="toggle active">Potential Alternatives <span class="arrow-down">&#9660;</span><span class="arrow-up">&#9650;</span></a>
	<div class="toggle-content article">
		<p>Compare the strongest third-pokemon candidates for the selected duo.</p>
		<div class="poke-search-container">
			<input class="poke-search" context="alternative-search" type="text" placeholder="Search Pokemon" />
			<a href="#" class="search-info">i</a>
			<a href="#" class="search-traits" title="Search Traits">+</a>
		</div>
		<div class="summary-legend" title="Core Score combines trio coverage, added coverage from the candidate, pair support, line flexibility, and penalties for critical gaps. Scenario volatility is shown separately.">
			<span class="legend-pill">Strong core</span>
			<span class="legend-pill">Usable core</span>
			<span class="legend-pill">Weak core</span>
			<span class="legend-help">?</span>
		</div>
		<div class="table-container">
			<div class="core-matchup-details active">
				<table class="alternatives-table rating-table" cellspacing="0"></table>
			</div>
		</div>
	</div>

	<a href="#" class="toggle active">Battle Histograms <span class="arrow-down">&#9660;</span><span class="arrow-up">&#9650;</span></a>
	<div class="toggle-content">
		<p>The charts below show how many good or bad matchups each Pokemon has among all matchups possible. A Battle Rating below 500 is a loss, and a Battle Rating above 500 is a win. You can compare previous results to examine different Pokemon, movesets, or stats.</p>
		<div class="histograms">
			<div class="histogram"></div>
			<div class="histogram"></div>
			<div class="histogram"></div>
			<div class="histogram"></div>
			<div class="histogram"></div>
			<div class="histogram"></div>
		</div>
	</div>

	<a href="#" class="toggle active">Defensive Typing <span class="arrow-down">&#9660;</span><span class="arrow-up">&#9650;</span></a>
	<div class="toggle-content">
		<div class="summary defense-summary"></div>
		<div class="defense"></div>
	</div>

	<a href="#" class="toggle active">Offensive Typing <span class="arrow-down">&#9660;</span><span class="arrow-up">&#9650;</span></a>
	<div class="toggle-content">
		<div class="summary offense-summary"></div>
		<div class="offense"></div>
	</div>

	<div class="share-link-container">
		<p>Share this team:</p>
		<div class="share-link">
			<input type="text" value="" readonly>
			<div class="copy">Copy</div>
		</div>
	</div>
</div>

<?php require_once 'modules/search-string-help.php'; ?>
<?php require_once 'modules/search-traits.php'; ?>

<?php require_once 'modules/scripts/battle-scripts.php'; ?>

<script src="<?php echo $WEB_ROOT; ?>js/GameMaster.js?v=<?php echo $SITE_VERSION; ?>"></script>
<script src="<?php echo $WEB_ROOT; ?>js/pokemon/Pokemon.js?v=<?php echo $SITE_VERSION; ?>"></script>
<script src="<?php echo $WEB_ROOT; ?>js/interface/TeamInterface.js?v=<?php echo $SITE_VERSION; ?>"></script>
<script src="<?php echo $WEB_ROOT; ?>js/interface/PokeMultiSelect.js?v=<?php echo $SITE_VERSION; ?>"></script>
<script src="<?php echo $WEB_ROOT; ?>js/interface/Pokebox.js?=<?php echo $SITE_VERSION; ?>"></script>
<script src="<?php echo $WEB_ROOT; ?>js/interface/PokeSelect.js?v=<?php echo $SITE_VERSION; ?>"></script>
<script src="<?php echo $WEB_ROOT; ?>js/interface/BattleHistogram.js?v=<?php echo $SITE_VERSION; ?>"></script>
<script src="<?php echo $WEB_ROOT; ?>js/interface/ModalWindow.js?v=<?php echo $SITE_VERSION; ?>"></script>
<script src="<?php echo $WEB_ROOT; ?>js/interface/PokeSearch.js?v=<?php echo $SITE_VERSION; ?>"></script>
<script src="<?php echo $WEB_ROOT; ?>js/battle/rankers/TeamRanker.js?v=<?php echo $SITE_VERSION; ?>"></script>
<script src="<?php echo $WEB_ROOT; ?>js/battle/analyzers/CoreSynergyAnalyzer.js?v=<?php echo $SITE_VERSION; ?>"></script>
<script src="<?php echo $WEB_ROOT; ?>js/Main.js?v=3"></script>

<?php require_once 'footer.php'; ?>
