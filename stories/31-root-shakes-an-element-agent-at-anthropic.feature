Feature: ROOT shakes an element agent that runs at Anthropic

  "leveraging their Agent's api"
  "so we can have an agent, that isnt hosted on the same box as QNTX"
  "it could even be a strong agent that would work on some PR and maybe even drive the complete thing"
  "via ROOT SHAKE"
  "if we use their infra, we use their infra"

  Scenario: The Console is what ROOT's agents spend
    Given I am ROOT
    And Node Connectors says ROOT's agents spend the Console
    When I shake an element
    Then its agent runs at Anthropic, as one of the Console's Agents
    And its conversation is one of the Console's Sessions
    And it reaches the node through the node's MCP
    And it has the element agent's repositories, and ground, in Anthropic's container

  Scenario: Shaken again
    Given I shook the element before
    When I shake it again
    Then its conversation goes on in the same Session
