
import React, { useEffect, useState } from 'react';
import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Checkbox,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  Input,
  Select,
  Slider,
  SliderFilledTrack,
  SliderThumb,
  SliderTrack,
  Spinner,
  Text,
  VStack,
  useToast,
} from '@chakra-ui/react';
import {
  getAgents,
  getKnowledgeBases,
  updateAgentConfig,
} from '../api';

const AgentConfig = () => {
  const toast = useToast();

  const [agents, setAgents] = useState([]);
  const [knowledgeBases, setKnowledgeBases] = useState([]);
  const [agentId, setAgentId] = useState('');
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [agentData, kbData] = await Promise.all([
          getAgents(),
          getKnowledgeBases(),
        ]);

        const validAgents = Array.isArray(agentData) ? agentData : [];
        const validKBs = Array.isArray(kbData) ? kbData : [];

        setAgents(validAgents);
        setKnowledgeBases(validKBs);

        if (validAgents.length) {
          setAgentId(validAgents[0].id);
          setConfig(makeConfig(validAgents[0], validKBs));
        }
      } catch (err) {
        setError(
          err.response?.data?.message ||
          'Could not load agent configuration.'
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const makeConfig = (agent, allKBs) => ({
    parameters: {
      temperature: agent.parameters?.temperature ?? 0.7,
      top_p: agent.parameters?.top_p ?? 1,
      max_tokens: agent.parameters?.max_tokens ?? 150,
    },
    capabilities: (agent.capabilities || []).map((item) => ({
      id: item.id,
      name: item.name,
      enabled: Boolean(item.enabled),
    })),
    knowledgeBases: allKBs.map((kb) => {
      const id = String(kb.id || kb._id);
      const saved = (agent.knowledgeBases || []).find(
        (item) => String(item.id) === id
      );

      return {
        id,
        name: kb.name || kb.title || id,
        enabled: saved ? Boolean(saved.enabled) : false,
      };
    }),
    escalationThresholds: {
      lowConfidence: agent.escalationThresholds?.lowConfidence ?? 0.4,
      negativeSentiment: agent.escalationThresholds?.negativeSentiment ?? 0.3,
      responseTime: agent.escalationThresholds?.responseTime ?? 60,
    },
  });

  const selectAgent = (id) => {
    setAgentId(id);
    const agent = agents.find((item) => item.id === id);
    if (agent) setConfig(makeConfig(agent, knowledgeBases));
    setError('');
  };

  const updateParameter = (key, value) => {
    setConfig((previous) => ({
      ...previous,
      parameters: { ...previous.parameters, [key]: value },
    }));
  };

  const updateThreshold = (key, value) => {
    setConfig((previous) => ({
      ...previous,
      escalationThresholds: {
        ...previous.escalationThresholds,
        [key]: value,
      },
    }));
  };

  const toggleItem = (key, id, enabled) => {
    setConfig((previous) => ({
      ...previous,
      [key]: previous[key].map((item) =>
        item.id === id ? { ...item, enabled } : item
      ),
    }));
  };

  const save = async () => {
    if (!agentId || !config || saving) return;

    setSaving(true);
    setError('');

    try {
      await updateAgentConfig(agentId, config);

      setAgents((previous) =>
        previous.map((agent) =>
          agent.id === agentId
            ? {
                ...agent,
                ...config,
                parameters: config.parameters,
                capabilities: config.capabilities,
                knowledgeBases: config.knowledgeBases,
                escalationThresholds: config.escalationThresholds,
              }
            : agent
        )
      );

      toast({
        title: 'Configuration saved',
        description: 'The agent configuration was saved to the backend.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Saving failed. Please check the backend.'
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Flex justify="center" py={12}>
        <Spinner size="xl" />
      </Flex>
    );
  }

  if (!agents.length || !config) {
    return (
      <Alert status="warning">
        <AlertIcon />
        No agents are available. Check your backend data.
      </Alert>
    );
  }

  return (
    <Box maxW="1000px" mx="auto" p={{ base: 4, md: 8 }}>
      <Flex
        justify="space-between"
        align={{ base: 'start', md: 'center' }}
        gap={3}
        wrap="wrap"
        mb={6}
      >
        <Heading size="lg">Configure AI Agent</Heading>
        <Button
          colorScheme="purple"
          onClick={save}
          isLoading={saving}
        >
          Save Changes
        </Button>
      </Flex>

      {error && (
        <Alert status="error" mb={4} borderRadius="md">
          <AlertIcon />
          {error}
        </Alert>
      )}

      <Box bg="white" borderWidth="1px" borderRadius="xl" p={5}>
        <FormControl mb={6}>
          <FormLabel>Agent</FormLabel>
          <Select value={agentId} onChange={(e) => selectAgent(e.target.value)}>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </Select>
        </FormControl>

        <Heading size="sm" mb={4}>Model parameters</Heading>

        {[
          { key: 'temperature', label: 'Temperature', min: 0, max: 1, step: 0.01 },
          { key: 'top_p', label: 'Top-p', min: 0, max: 1, step: 0.01 },
        ].map(({ key, label, min, max, step }) => (
          <Box key={key} mb={5}>
            <Flex justify="space-between" mb={2}>
              <Text>{label}</Text>
              <Text>{config.parameters[key].toFixed(2)}</Text>
            </Flex>
            <Slider
              min={min}
              max={max}
              step={step}
              value={config.parameters[key]}
              onChange={(value) => updateParameter(key, value)}
            >
              <SliderTrack>
                <SliderFilledTrack />
              </SliderTrack>
              <SliderThumb />
            </Slider>
          </Box>
        ))}

        <FormControl mb={6}>
          <FormLabel>Maximum tokens</FormLabel>
          <Input
            type="number"
            min={1}
            value={config.parameters.max_tokens}
            onChange={(e) =>
              updateParameter(
                'max_tokens',
                Math.max(1, Number(e.target.value) || 1)
              )
            }
          />
        </FormControl>

        <Heading size="sm" mb={3}>Capabilities</Heading>
        <VStack align="stretch" mb={6} spacing={2}>
          {config.capabilities.map((item) => (
            <Checkbox
              key={item.id}
              isChecked={item.enabled}
              onChange={(e) =>
                toggleItem('capabilities', item.id, e.target.checked)
              }
            >
              {item.name}
            </Checkbox>
          ))}
          {!config.capabilities.length && (
            <Text color="gray.500">No capabilities are configured for this agent.</Text>
          )}
        </VStack>

        <Heading size="sm" mb={3}>Knowledge-base access</Heading>
        <VStack align="stretch" mb={6} spacing={2}>
          {config.knowledgeBases.map((item) => (
            <Checkbox
              key={item.id}
              isChecked={item.enabled}
              onChange={(e) =>
                toggleItem('knowledgeBases', item.id, e.target.checked)
              }
            >
              {item.name}
            </Checkbox>
          ))}
          {!config.knowledgeBases.length && (
            <Text color="gray.500">No knowledge bases are available.</Text>
          )}
        </VStack>

        <Heading size="sm" mb={4}>Escalation thresholds</Heading>

        <FormControl mb={4}>
          <FormLabel>Minimum confidence (0–1)</FormLabel>
          <Input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={config.escalationThresholds.lowConfidence}
            onChange={(e) =>
              updateThreshold(
                'lowConfidence',
                Math.min(1, Math.max(0, Number(e.target.value) || 0))
              )
            }
          />
        </FormControl>

        <FormControl mb={4}>
          <FormLabel>Negative sentiment threshold (0–1)</FormLabel>
          <Input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={config.escalationThresholds.negativeSentiment}
            onChange={(e) =>
              updateThreshold(
                'negativeSentiment',
                Math.min(1, Math.max(0, Number(e.target.value) || 0))
              )
            }
          />
        </FormControl>

        <FormControl>
          <FormLabel>Response-time threshold (seconds)</FormLabel>
          <Input
            type="number"
            min={1}
            value={config.escalationThresholds.responseTime}
            onChange={(e) =>
              updateThreshold(
                'responseTime',
                Math.max(1, Number(e.target.value) || 1)
              )
            }
          />
        </FormControl>
      </Box>
    </Box>
  );
};

export default AgentConfig;
