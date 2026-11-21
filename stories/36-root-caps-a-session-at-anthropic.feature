Feature: ROOT caps what a Session at Anthropic may spend

  "6SION00: The bad managed Agents session needs to not be able to murder us further."
  "6SION0: We know now that one bad session can eat up an entire Org budget and more."
  "Show in Node Connector ability to set limit from QNTX ui or show that it's unbounded when it is."
  "like set it in the ui and make default of 200"

  Scenario: ROOT sees the cap the node holds
    Given I am ROOT
    When I open Node Connectors from am
    Then the Anthropic row shows the most a Session at Anthropic may spend, with its currency: 200 USD
    And it says this is the node's default, as no cap was set

  Scenario: ROOT sets the cap
    Given the Anthropic row shows the cap
    When I type 50 as the cap and press Set cap
    Then the row shows 50 USD
    And it no longer says this is the node's default

  Scenario: ROOT goes back to the default
    Given I set the cap to 50
    When I empty the cap and press Set cap
    Then the row shows 200 USD
    And it says this is the node's default

  Scenario: A cap the node does not take
    When I type 0 as the cap and press Set cap
    Then the row says why the node does not take it
    And the cap the node holds stays as it was

  Scenario: A node that caps no Session says it is unbounded
    Given the node answers with no cap
    When I open Node Connectors from am
    Then the Anthropic row says plainly that what a Session at Anthropic spends is unbounded
    And it shows no cap to set
