Feature: ROOT changes a User's level

  Scenario: ROOT raises a User
    Given I am ROOT
    When I open a User from the Users element
    And I choose a level for them
    And I press Set level
    Then the User holds that level
    And the act is attested as identity:leveled, naming who, the level they had, and the level they hold now

  Scenario: ROOT is offered the levels the gate admits a User at
    Given I am ROOT
    When I open a User from the Users element
    Then I am offered USER and PUBLIC_REGISTRATION
