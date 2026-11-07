Feature: ROOT sets up Telegram node wide

  "and i will also connect the Node Room to a Telegram group i have"
  "the telegram part of the User Story should be its own user story, you set up telegram node wide"
  "as another connector on am next to the other ones above the Obsidian one for example"

  Background:
    Given I am ROOT

  Scenario: ROOT finds Telegram among the Node Connectors
    When I open am
    And I open Node Connectors
    Then Telegram is a connector there, next to the other ones, above the Obsidian one

  Scenario: ROOT connects a Telegram group to the Node Room
    Given I am in Node Connectors
    When I press Telegram
    And I set up Telegram node wide
    Then the Node Room is connected to the Telegram group I have
