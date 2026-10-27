Feature: ROOT orders what its agents spend at Anthropic

  "the Anthropic Node Connector needs to show two light indicators,"
  "the one that already exists, and the session"
  "and it needs to be clear which one we are using."
  "as a ROOT user, i expect to see balance."
  "we use session first until exhaustion"
  "Optionally declare that iodc Console balance will be utilised when session is exhausted"
  "we use iodc Console balance until exhaustion"
  "Optionally declare that we will use session when API balance is exhausted"
  "this applies to all agents belonging to ROOT."

  Scenario: ROOT sees both, and which one is in use
    Given I am ROOT
    When I open Node Connectors from am
    Then the Anthropic row shows two lights, in the order they are used:
      | light   | what it is                      | shows      |
      | Session | my Claude subscription login    | usage left |
      | Console | the node's OIDC, at the Console | balance    |
    And the one in use is marked

  Scenario: Session first, until exhaustion
    Given Session is first
    When the session is exhausted
    Then ROOT's agents stop, unless I ticked Console to follow

  Scenario: Console first, until exhaustion
    Given I swap the two
    Then Console is first
    When the Console balance is exhausted
    Then ROOT's agents stop, unless I ticked Session to follow

  Scenario: What follows
    Given I ticked the second light's box
    When the first is exhausted
    Then ROOT's agents go on with the second
    And the mark of what is in use moves to it
