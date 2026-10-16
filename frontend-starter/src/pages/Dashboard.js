
import React, { useMemo, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Flex,
  Grid,
  Heading,
  HStack,
  Input,
  Select,
  SimpleGrid,
  Text,
  VStack,
  Progress,
  Spinner,
  Alert,
  AlertIcon,
  useToast,
} from '@chakra-ui/react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as ChartTooltip,
  CartesianGrid,
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useAppData } from '../context/AppDataContext';

const PURPLE = '#514080';

const panelStyle = {
  bg: 'white',
  border: '1px solid',
  borderColor: 'gray.200',
  borderRadius: 'xl',
  p: 4,
  minW: 0,
};

const getCustomerName = (conversation) =>
  typeof conversation.customer === 'string'
    ? conversation.customer
    : conversation.customer?.name || 'Unknown customer';

const getId = (conversation) =>
  conversation.id || conversation._id;

const getRisk = (conversation) => {
  if (conversation.alertLevel === 'high') return 'Critical';
  if (conversation.alertLevel === 'medium') return 'High';
  if (conversation.status === 'escalated') return 'Escalated';
  return 'Normal';
};

const riskColor = (risk) => {
  if (risk === 'Critical' || risk === 'Escalated') return 'red';
  if (risk === 'High') return 'orange';
  return 'green';
};

const StatCard = ({ label, value, detail, color = PURPLE }) => (
  <Box {...panelStyle}>
    <Text color="gray.500" fontSize="xs" fontWeight="600">
      {label}
    </Text>
    <Heading size="lg" mt={2} color={color}>
      {value}
    </Heading>
    <Text color="gray.500" fontSize="xs" mt={2}>
      {detail}
    </Text>
  </Box>
);

export default function Dashboard() {
  const {
    conversations = [],
    agents = [],
    loading = {},
    error = {},
  } = useAppData();

  const navigate = useNavigate();
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [agentFilter, setAgentFilter] = useState('all');
  const [timeRange, setTimeRange] = useState('30m');

  const activeCount = conversations.filter(
    (c) => c.status === 'active' || c.status === 'waiting'
  ).length;

  const escalatedCount = conversations.filter(
    (c) => c.status === 'escalated'
  ).length;

  const criticalCount = conversations.filter(
    (c) => c.alertLevel === 'high' || c.status === 'escalated'
  ).length;

  const averageSentiment = conversations.length
    ? conversations.reduce(
        (sum, c) => sum + (Number(c.metrics?.sentiment) || 0),
        0
      ) / conversations.length
    : 0;

  const satisfaction = conversations.length
    ? `${Math.max(0, Math.min(100, Math.round(
        averageSentiment > 1
          ? averageSentiment
          : averageSentiment * 100
      )))}%`
    : '—';

  const averageResponse = conversations.length
    ? (
        conversations.reduce(
          (sum, c) => sum + (Number(c.metrics?.responseTime) || 0),
          0
        ) / conversations.length
      ).toFixed(1) + 's'
    : '—';

  const filteredConversations = useMemo(() => {
    return conversations.filter((conversation) => {
      const customer = getCustomerName(conversation).toLowerCase();
      const id = String(getId(conversation) || '').toLowerCase();
      const agentName = String(
        conversation.agent?.name || conversation.agent || ''
      ).toLowerCase();

      const matchesSearch =
        !search ||
        customer.includes(search.toLowerCase()) ||
        id.includes(search.toLowerCase()) ||
        agentName.includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === 'all' || conversation.status === statusFilter;

      const risk = getRisk(conversation).toLowerCase();
      const matchesRisk =
        riskFilter === 'all' || risk === riskFilter;

      const conversationAgentId =
        conversation.agent?.id || conversation.agentId || '';

      const matchesAgent =
        agentFilter === 'all' || conversationAgentId === agentFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesRisk &&
        matchesAgent
      );
    });
  }, [
    conversations,
    search,
    statusFilter,
    riskFilter,
    agentFilter,
  ]);

  
  const chartData = useMemo(() => {
    const buckets = new Map();

    conversations.forEach((conversation) => {
      const date = conversation.startTime
        ? new Date(conversation.startTime)
        : null;

      if (!date || Number.isNaN(date.getTime())) return;

      const key = `${date.getHours()}:${String(
        date.getMinutes()
      ).padStart(2, '0')}`;

      buckets.set(key, (buckets.get(key) || 0) + 1);
    });

    const points = Array.from(buckets, ([time, count]) => ({
      time,
      conversations: count,
    }));

    // Display only real conversation data. Never invent chart values.
    return points.slice(-8);
  }, [conversations]);


  const queueGroups = useMemo(() => {
    const groups = {};

    conversations.forEach((conversation) => {
      const agentName =
        conversation.agent?.name ||
        (typeof conversation.agent === 'string'
          ? conversation.agent
          : 'Unassigned');

      groups[agentName] = (groups[agentName] || 0) + 1;
    });

    return Object.entries(groups)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
  }, [conversations]);

  const activityItems = useMemo(() => {
    return [...conversations]
      .sort(
        (a, b) =>
          new Date(b.updatedAt || b.startTime || 0) -
          new Date(a.updatedAt || a.startTime || 0)
      )
      .slice(0, 6);
  }, [conversations]);

  const exportReport = () => {
    const rows = [
      ['Conversation ID', 'Customer', 'Agent', 'Status', 'Risk'],
      ...filteredConversations.map((c) => [
        getId(c),
        getCustomerName(c),
        c.agent?.name || c.agent || 'Unassigned',
        c.status || 'unknown',
        getRisk(c),
      ]),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
          .join(',')
      )
      .join('\r\n');

    const url = URL.createObjectURL(
      new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    );

    const link = document.createElement('a');
    link.href = url;
    link.download = 'zangoh-supervisor-report.csv';
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'Report exported',
      description: 'Your filtered conversation report was downloaded.',
      status: 'success',
      duration: 2500,
      isClosable: true,
    });
  };

  if (loading.conversations && conversations.length === 0) {
    return (
      <Flex minH="50vh" align="center" justify="center" direction="column" gap={3}>
        <Spinner size="xl" color={PURPLE} />
        <Text color="gray.500">Loading supervisor dashboard...</Text>
      </Flex>
    );
  }

  return (
    <Box maxW="1600px" mx="auto" color="gray.800">
      <Flex
        justify="space-between"
        align={{ base: 'start', md: 'center' }}
        gap={4}
        wrap="wrap"
        mb={6}
      >
        <Box>
          <Heading size="lg">Dashboard</Heading>
          <Text color="gray.500" fontSize="sm" mt={1}>
            Live supervision across customer conversations and AI agents
          </Text>
        </Box>

        <HStack spacing={2} wrap="wrap">
          <Select
            size="sm"
            w="120px"
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            aria-label="Dashboard time range"
          >
            <option value="30m">Last 30 min</option>
            <option value="today">Today</option>
            <option value="week">Last 7 days</option>
          </Select>
          <Button
            size="sm"
            colorScheme="purple"
            bg={PURPLE}
            onClick={exportReport}
          >
            Export report
          </Button>
        </HStack>
      </Flex>

      {error.conversations && (
        <Alert status="error" borderRadius="lg" mb={4}>
          <AlertIcon />
          Could not load conversations: {error.conversations}
        </Alert>
      )}

      <SimpleGrid columns={{ base: 1, sm: 2, xl: 5 }} spacing={3} mb={5}>
        <StatCard
          label="ACTIVE LOAD"
          value={activeCount.toLocaleString()}
          detail="Active and waiting conversations"
        />
        <StatCard
          label="ESCALATIONS"
          value={escalatedCount}
          detail="Cases requiring human attention"
          color={escalatedCount ? '#C53030' : PURPLE}
        />
        <StatCard
          label="HIGH-RISK CASES"
          value={criticalCount}
          detail="Critical alerts and escalations"
          color={criticalCount ? '#C53030' : PURPLE}
        />
        <StatCard
          label="AVG. RESPONSE TIME"
          value={averageResponse}
          detail="Based on available conversation metrics"
        />
        <StatCard
          label="CUSTOMER SENTIMENT"
          value={satisfaction}
          detail="Estimated from available sentiment data"
        />
      </SimpleGrid>

      <Grid
        templateColumns={{ base: '1fr', xl: '1.5fr 1fr 0.9fr' }}
        gap={4}
        mb={5}
      >
        <Box {...panelStyle}>
          <Heading size="sm">Conversation volume</Heading>
          <Text color="gray.500" fontSize="xs" mt={1} mb={4}>
            Conversation start times from the available dataset
          </Text>
          <Box h="220px">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid stroke="#ECEAF2" strokeDasharray="3 3" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <ChartTooltip />
                <Line
                  type="monotone"
                  dataKey="conversations"
                  stroke={PURPLE}
                  strokeWidth={3}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
          <Badge colorScheme="purple">Conversation activity</Badge>
        </Box>

        <Box {...panelStyle}>
          <Heading size="sm">Queue health</Heading>
          <Text color="gray.500" fontSize="xs" mt={1} mb={5}>
            Workload grouped by assigned agent
          </Text>

          {queueGroups.length ? (
            <VStack align="stretch" spacing={5}>
              {queueGroups.map(([name, count]) => (
                <Box key={name}>
                  <Flex justify="space-between" mb={2} gap={2}>
                    <Text fontSize="sm" noOfLines={1}>{name}</Text>
                    <Text fontSize="sm" fontWeight="600">{count}</Text>
                  </Flex>
                  <Progress
                    value={
                      (count /
                        Math.max(
                          1,
                          ...queueGroups.map((group) => group[1])
                        )) *
                      100
                    }
                    colorScheme="purple"
                    size="sm"
                    borderRadius="full"
                  />
                </Box>
              ))}
            </VStack>
          ) : (
            <Text color="gray.500" fontSize="sm">
              No queue data available.
            </Text>
          )}

          <Button
            mt={6}
            size="sm"
            variant="outline"
            w="full"
            onClick={() => navigate('/agent-config')}
          >
            View agent controls
          </Button>
        </Box>

        <Box {...panelStyle}>
          <Heading size="sm">Critical signals</Heading>
          <Text color="gray.500" fontSize="xs" mt={1} mb={4}>
            Conversations that may need attention
          </Text>

          <VStack align="stretch" spacing={3}>
            <Box bg="red.50" borderRadius="lg" p={3}>
              <Badge colorScheme="red">Critical</Badge>
              <Text fontWeight="600" fontSize="sm" mt={1}>
                High-risk conversations
              </Text>
              <Text color="gray.600" fontSize="xs">
                {conversations.filter((c) => c.alertLevel === 'high').length}{' '}
                conversation(s) have a high alert level.
              </Text>
            </Box>

            <Box bg="orange.50" borderRadius="lg" p={3}>
              <Badge colorScheme="orange">Escalation</Badge>
              <Text fontWeight="600" fontSize="sm" mt={1}>
                Human intervention
              </Text>
              <Text color="gray.600" fontSize="xs">
                {escalatedCount} conversation(s) are escalated.
              </Text>
            </Box>

            <Box bg="purple.50" borderRadius="lg" p={3}>
              <Badge colorScheme="purple">Monitoring</Badge>
              <Text fontWeight="600" fontSize="sm" mt={1}>
                Active agents
              </Text>
              <Text color="gray.600" fontSize="xs">
                {agents.filter((a) => a.status === 'active').length} of{' '}
                {agents.length} agents are marked active.
              </Text>
            </Box>
          </VStack>
        </Box>
      </Grid>

      <Grid templateColumns={{ base: '1fr', xl: '1.7fr 1fr' }} gap={4}>
        <Box {...panelStyle}>
          <Flex justify="space-between" align="center" mb={4} gap={3} wrap="wrap">
            <Box>
              <Heading size="sm">Priority conversation queue</Heading>
              <Text color="gray.500" fontSize="xs" mt={1}>
                Filter cases and open a conversation to review it
              </Text>
            </Box>
            <Badge colorScheme="purple">
              {filteredConversations.length} results
            </Badge>
          </Flex>

          <Grid
            templateColumns={{ base: '1fr', md: '2fr 1fr 1fr 1fr' }}
            gap={2}
            mb={4}
          >
            <Input
              size="sm"
              placeholder="Search customer, case, or agent..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search conversations"
            />

            <Select
              size="sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="waiting">Waiting</option>
              <option value="escalated">Escalated</option>
              <option value="resolved">Resolved</option>
            </Select>

            <Select
              size="sm"
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              aria-label="Filter by risk"
            >
              <option value="all">All risk levels</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="escalated">Escalated</option>
              <option value="normal">Normal</option>
            </Select>

            <Select
              size="sm"
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              aria-label="Filter by agent"
            >
              <option value="all">All agents</option>
              {agents.map((agent) => (
                <option key={agent.id || agent._id} value={agent.id || agent._id}>
                  {agent.name}
                </option>
              ))}
            </Select>
          </Grid>

          <Box overflowX="auto">
            <Box minW="650px">
              <Grid
                templateColumns="1.5fr 1fr 0.8fr 0.8fr 0.8fr"
                gap={3}
                px={2}
                py={2}
                bg="gray.50"
                borderRadius="md"
                mb={2}
              >
                {['CUSTOMER / CASE', 'AI AGENT', 'STATUS', 'RISK', 'ACTION'].map(
                  (heading) => (
                    <Text key={heading} fontSize="xs" fontWeight="700" color="gray.500">
                      {heading}
                    </Text>
                  )
                )}
              </Grid>

              {filteredConversations.map((conversation) => {
                const id = getId(conversation);
                const risk = getRisk(conversation);
                const agentName =
                  conversation.agent?.name ||
                  (typeof conversation.agent === 'string'
                    ? conversation.agent
                    : 'Unassigned');

                return (
                  <Grid
                    key={id}
                    templateColumns="1.5fr 1fr 0.8fr 0.8fr 0.8fr"
                    gap={3}
                    alignItems="center"
                    px={2}
                    py={3}
                    borderBottom="1px solid"
                    borderColor="gray.100"
                    _hover={{ bg: 'purple.50' }}
                  >
                    <Box>
                      <Text fontSize="sm" fontWeight="600">
                        {getCustomerName(conversation)}
                      </Text>
                      <Text fontSize="xs" color="gray.500">
                        Case #{String(id || '').slice(-8)}
                      </Text>
                    </Box>

                    <Text fontSize="sm" noOfLines={1}>{agentName}</Text>

                    <Badge
                      width="fit-content"
                      colorScheme={
                        conversation.status === 'escalated'
                          ? 'red'
                          : conversation.status === 'resolved'
                          ? 'green'
                          : 'purple'
                      }
                    >
                      {conversation.status || 'unknown'}
                    </Badge>

                    <Badge
                      width="fit-content"
                      colorScheme={riskColor(risk)}
                    >
                      {risk}
                    </Badge>

                    <Button
                      size="xs"
                      colorScheme="purple"
                      variant="ghost"
                      isDisabled={!id}
                      onClick={() => navigate(`/conversation/${id}`)}
                    >
                      Review
                    </Button>
                  </Grid>
                );
              })}

              {!filteredConversations.length && (
                <Text textAlign="center" color="gray.500" py={8}>
                  No conversations match these filters.
                </Text>
              )}
            </Box>
          </Box>
        </Box>

        <Box {...panelStyle}>
          <Flex justify="space-between" align="center" mb={4}>
            <Heading size="sm">Supervisor activity feed</Heading>
            <Badge colorScheme="green">Latest data</Badge>
          </Flex>

          <Text color="gray.500" fontSize="xs" mb={4}>
            Recent conversations based on their latest available timestamps.
            Live updates depend on the WebSocket service.
          </Text>

          <VStack align="stretch" spacing={4}>
            {activityItems.map((conversation) => (
              <Flex key={getId(conversation)} gap={3} align="start">
                <Box
                  mt={1}
                  boxSize="9px"
                  borderRadius="full"
                  bg={
                    conversation.status === 'escalated'
                      ? 'red.400'
                      : conversation.alertLevel === 'high'
                      ? 'orange.400'
                      : PURPLE
                  }
                  flexShrink={0}
                />
                <Box flex="1" minW={0}>
                  <Text fontSize="sm" fontWeight="600">
                    {conversation.status === 'escalated'
                      ? 'Conversation escalated'
                      : conversation.alertLevel === 'high'
                      ? 'High-risk conversation flagged'
                      : 'Conversation activity'}
                  </Text>
                  <Text fontSize="xs" color="gray.500">
                    {getCustomerName(conversation)} ·{' '}
                    {conversation.agent?.name || 'AI agent'}
                  </Text>
                  <Button
                    size="xs"
                    mt={1}
                    variant="link"
                    colorScheme="purple"
                    onClick={() =>
                      navigate(`/conversation/${getId(conversation)}`)
                    }
                  >
                    Open case
                  </Button>
                </Box>
              </Flex>
            ))}

            {!activityItems.length && (
              <Text fontSize="sm" color="gray.500">
                Activity will appear when conversation data is available.
              </Text>
            )}
          </VStack>
        </Box>
      </Grid>
    </Box>
  );
}
