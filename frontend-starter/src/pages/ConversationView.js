
import React, { useEffect, useState } from 'react';
import {
  Alert,
  AlertIcon,
  Avatar,
  Badge,
  Box,
  Button,
  Divider,
  Flex,
  Heading,
  HStack,
  Spinner,
  Text,
  Textarea,
  VStack,
  useToast,
} from '@chakra-ui/react';
import { useParams } from 'react-router-dom';
import {
  addMessage,
  getConversation,
  interveneInConversation,
  releaseIntervention,
  updateConversationStatus,
} from '../api';
import { useAppData } from '../context/AppDataContext';

const PURPLE = '#514080';
const SUPERVISOR_ID = 'supervisor-1';

const customerName = (conversation) =>
  typeof conversation?.customer === 'string'
    ? conversation.customer
    : conversation?.customer?.name || 'Customer';

const getRiskColor = (level) => {
  if (level === 'high') return 'red';
  if (level === 'medium') return 'orange';
  return 'green';
};

const ConversationView = () => {
  const { id } = useParams();
  const toast = useToast();

  const {
    conversations = [],
    updateConversation,
  } = useAppData();

  const [conversation, setConversation] = useState(null);
  const [draft, setDraft] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pageError, setPageError] = useState('');

  const isTakenOver = Boolean(
    conversation?.humanIntervention?.occurred
  );

  useEffect(() => {
    let cancelled = false;

    const loadConversation = async () => {
      setLoading(true);
      setPageError('');

      try {
        const result = await getConversation(id);

        if (!cancelled) {
          setConversation(result);
        }
      } catch (error) {
        // Fall back to the shared conversation list if the detail
        // endpoint is temporarily unavailable.
        const cached = conversations.find(
          (item) => String(item.id || item._id) === String(id)
        );

        if (!cancelled && cached) {
          setConversation(cached);
        } else if (!cancelled) {
          setPageError(
            error.response?.data?.message ||
              'Could not load this conversation. Check the backend connection.'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadConversation();

    return () => {
      cancelled = true;
    };
    // Load when the selected conversation changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const syncConversation = (updated) => {
    setConversation(updated);

    if (updated) {
      updateConversation?.(
        String(updated.id || updated._id),
        updated
      );
    }
  };

  const handleTakeOver = async () => {
    if (!conversation || busy || isTakenOver) return;

    setBusy(true);
    setPageError('');

    try {
      await interveneInConversation(
        String(conversation.id || conversation._id),
        SUPERVISOR_ID,
        notes.trim()
      );

      const updated = {
        ...conversation,
        status: 'escalated',
        humanIntervention: {
          ...(conversation.humanIntervention || {}),
          occurred: true,
          supervisorId: SUPERVISOR_ID,
          timestamp: new Date().toISOString(),
          notes: notes.trim(),
        },
      };

      syncConversation(updated);

      toast({
        title: 'Conversation taken over',
        description: 'Supervisor control has been requested successfully.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      setPageError(
        error.response?.data?.message ||
          'Takeover failed. Please check the backend and try again.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleSendMessage = async () => {
    const text = draft.trim();

    if (!text || !conversation || busy) return;

    setBusy(true);
    setPageError('');

    try {
      const conversationId = String(
        conversation.id || conversation._id
      );

      const savedMessage = await addMessage(conversationId, {
        sender: 'supervisor',
        text,
      });

      const message =
        savedMessage?.text
          ? savedMessage
          : savedMessage?.message?.text
          ? savedMessage.message
          : {
              sender: 'supervisor',
              text,
              timestamp: new Date().toISOString(),
            };

      syncConversation({
        ...conversation,
        messages: [...(conversation.messages || []), message],
      });

      setDraft('');

      toast({
        title: 'Message sent',
        status: 'success',
        duration: 2000,
        isClosable: true,
      });
    } catch (error) {
      setPageError(
        error.response?.data?.message ||
          'Could not send the message. Please try again.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleReturnToAI = async () => {
    if (!conversation || busy || !isTakenOver) return;

    setBusy(true);
    setPageError('');

    try {
      const conversationId = String(
        conversation.id || conversation._id
      );

      await releaseIntervention(conversationId, notes.trim());

      // Reload persisted state after returning control to the AI.
      const updated = await getConversation(conversationId);
      syncConversation(updated);
      setNotes('');

      toast({
        title: 'Control returned to AI',
        description: 'Supervisor notes have been submitted.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      setPageError(
        error.response?.data?.message ||
          'Could not return control to the AI. Please try again.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleResolve = async () => {
    if (!conversation || busy) return;

    setBusy(true);
    setPageError('');

    try {
      const conversationId = String(
        conversation.id || conversation._id
      );

      await updateConversationStatus(conversationId, 'resolved');

      syncConversation({
        ...conversation,
        status: 'resolved',
        endTime: new Date().toISOString(),
      });

      toast({
        title: 'Conversation resolved',
        status: 'success',
        duration: 2500,
        isClosable: true,
      });
    } catch (error) {
      setPageError(
        error.response?.data?.message ||
          'Could not resolve the conversation.'
      );
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Flex minH="50vh" justify="center" align="center" direction="column" gap={3}>
        <Spinner size="xl" color={PURPLE} />
        <Text color="gray.500">Loading conversation history...</Text>
      </Flex>
    );
  }

  if (!conversation) {
    return (
      <Alert status="error" borderRadius="lg">
        <AlertIcon />
        {pageError || 'Conversation not found.'}
      </Alert>
    );
  }

  const customer = conversation.customer;
  const metrics = conversation.metrics || {};
  const messages = conversation.messages || [];

  return (
    <Box maxW="1600px" mx="auto" color="gray.800">
      <Box mb={5}>
        <Heading size="lg">Customer Conversations</Heading>
        <Text color="gray.500" fontSize="sm" mt={1}>
          Review the conversation, intervene when necessary, and guide the AI.
        </Text>
      </Box>

      {pageError && (
        <Alert status="error" borderRadius="lg" mb={4}>
          <AlertIcon />
          {pageError}
        </Alert>
      )}

      <Flex
        gap={4}
        align="stretch"
        direction={{ base: 'column', xl: 'row' }}
      >
        {/* Conversation history */}
        <Box
          flex="1"
          minW={0}
          bg="white"
          border="1px solid"
          borderColor="gray.200"
          borderRadius="xl"
          p={{ base: 3, md: 5 }}
        >
          <Flex
            justify="space-between"
            align={{ base: 'start', md: 'center' }}
            gap={3}
            wrap="wrap"
            mb={4}
          >
            <HStack spacing={3}>
              <Avatar
                size="sm"
                name={customerName(conversation)}
                bg="orange.100"
                color="orange.800"
              />
              <Box>
                <Heading size="sm">
                  {customerName(conversation)} · Case #
                  {String(conversation.id || conversation._id).slice(-8)}
                </Heading>
                <Text fontSize="xs" color="gray.500" mt={1}>
                  {conversation.agent?.name ||
                    (typeof conversation.agent === 'string'
                      ? conversation.agent
                      : 'AI agent')}
                  {' · '}
                  {conversation.status || 'active'}
                </Text>
              </Box>
            </HStack>

            <HStack spacing={2} wrap="wrap">
              <Badge colorScheme={getRiskColor(conversation.alertLevel)}>
                {conversation.alertLevel || 'low'} risk
              </Badge>

              {isTakenOver && (
                <Badge colorScheme="purple">Supervisor in control</Badge>
              )}

              {!isTakenOver && conversation.status !== 'resolved' && (
                <Button
                  size="sm"
                  bg={PURPLE}
                  color="white"
                  _hover={{ bg: '#403165' }}
                  onClick={handleTakeOver}
                  isLoading={busy}
                >
                  Take over
                </Button>
              )}
            </HStack>
          </Flex>

          {conversation.alertLevel === 'high' && (
            <Alert status="warning" borderRadius="lg" mb={4}>
              <AlertIcon />
              High-risk conversation. Review the conversation before allowing
              the AI to continue.
            </Alert>
          )}

          <Divider mb={4} />

          <VStack
            align="stretch"
            spacing={4}
            minH="300px"
            maxH="55vh"
            overflowY="auto"
            pr={1}
          >
            {messages.map((message, index) => {
              const sender = message.sender || 'customer';
              const isAgent = sender === 'agent';
              const isSupervisor = sender === 'supervisor';

              return (
                <Flex
                  key={message._id || `${message.timestamp}-${index}`}
                  justify={
                    isAgent || isSupervisor ? 'flex-end' : 'flex-start'
                  }
                >
                  <Box
                    maxW={{ base: '92%', md: '78%' }}
                    bg={
                      isSupervisor
                        ? '#E8E0F8'
                        : isAgent
                        ? '#F0ECF7'
                        : '#F5F5F8'
                    }
                    borderRadius="xl"
                    px={4}
                    py={3}
                  >
                    <Flex justify="space-between" gap={4} mb={1}>
                      <Text fontSize="xs" fontWeight="700" color={PURPLE}>
                        {isSupervisor
                          ? 'SUPERVISOR'
                          : isAgent
                          ? 'AI AGENT'
                          : 'CUSTOMER'}
                      </Text>

                      {message.timestamp && (
                        <Text fontSize="xs" color="gray.500">
                          {new Date(message.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                      )}
                    </Flex>

                    <Text fontSize="sm" whiteSpace="pre-wrap">
                      {message.text}
                    </Text>
                  </Box>
                </Flex>
              );
            })}

            {!messages.length && (
              <Text color="gray.500" fontSize="sm" textAlign="center" py={8}>
                No messages are available for this conversation.
              </Text>
            )}
          </VStack>

          <Divider my={4} />

          <Box>
            <Flex justify="space-between" align="center" mb={2}>
              <Heading size="sm">Supervisor response</Heading>
              <Badge colorScheme={isTakenOver ? 'purple' : 'gray'}>
                {isTakenOver ? 'Manual control' : 'Supervisor message'}
              </Badge>
            </Flex>

            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Write a message to the customer..."
              resize="vertical"
              minH="100px"
              isDisabled={conversation.status === 'resolved'}
            />

            <Flex justify="flex-end" mt={3}>
              <Button
                bg={PURPLE}
                color="white"
                _hover={{ bg: '#403165' }}
                onClick={handleSendMessage}
                isLoading={busy}
                isDisabled={
                  !draft.trim() || conversation.status === 'resolved'
                }
              >
                Send reply
              </Button>
            </Flex>
          </Box>
        </Box>

        {/* Customer intelligence and supervisor controls */}
        <VStack
          w={{ base: '100%', xl: '310px' }}
          flexShrink={0}
          align="stretch"
          spacing={4}
        >
          <Box
            bg="white"
            border="1px solid"
            borderColor="gray.200"
            borderRadius="xl"
            p={4}
          >
            <Heading size="sm" mb={4}>Customer intelligence</Heading>

            <HStack spacing={3} mb={4}>
              <Avatar name={customerName(conversation)} size="sm" />
              <Box minW={0}>
                <Text fontWeight="600" fontSize="sm">
                  {customerName(conversation)}
                </Text>
                <Text color="gray.500" fontSize="xs">
                  {customer?.email || 'Customer profile'}
                </Text>
              </Box>
            </HStack>

            <Divider mb={4} />

            <Text color="gray.500" fontSize="xs">CONVERSATION STATUS</Text>
            <Heading size="md" mt={1} textTransform="capitalize">
              {conversation.status || 'active'}
            </Heading>

            <Text color="gray.500" fontSize="xs" mt={4}>
              RESPONSE TIME
            </Text>
            <Heading size="md" mt={1}>
              {metrics.responseTime != null
                ? `${metrics.responseTime}s`
                : 'N/A'}
            </Heading>

            <Text color="gray.500" fontSize="xs" mt={4}>
              CONFIDENCE SCORE
            </Text>
            <Heading size="md" mt={1}>
              {metrics.confidenceScore != null
                ? `${Math.round(
                    metrics.confidenceScore <= 1
                      ? metrics.confidenceScore * 100
                      : metrics.confidenceScore
                  )}%`
                : 'N/A'}
            </Heading>

            <Text color="gray.500" fontSize="xs" mt={4}>
              CONVERSATION STARTED
            </Text>
            <Text fontSize="sm" mt={1}>
              {conversation.startTime
                ? new Date(conversation.startTime).toLocaleString()
                : 'Unknown'}
            </Text>
          </Box>

          <Box
            bg="white"
            border="1px solid"
            borderColor="gray.200"
            borderRadius="xl"
            p={4}
          >
            <Heading size="sm" mb={2}>Supervisor feedback notes</Heading>
            <Text color="gray.500" fontSize="xs" mb={3}>
              Record guidance for the AI before returning control.
            </Text>

            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Explain the decision, correction, or follow-up needed..."
              bg="yellow.50"
              minH="120px"
              resize="vertical"
            />

            <Button
              mt={3}
              w="full"
              size="sm"
              colorScheme="purple"
              variant="outline"
              onClick={handleTakeOver}
              isLoading={busy}
              isDisabled={isTakenOver || conversation.status === 'resolved'}
            >
              Take over with notes
            </Button>

            <Button
              mt={2}
              w="full"
              size="sm"
              bg={PURPLE}
              color="white"
              _hover={{ bg: '#403165' }}
              onClick={handleReturnToAI}
              isLoading={busy}
              isDisabled={!isTakenOver || conversation.status === 'resolved'}
            >
              Return control to AI
            </Button>

            <Divider my={4} />

            <Button
              w="full"
              size="sm"
              colorScheme="green"
              variant="solid"
              onClick={handleResolve}
              isLoading={busy}
              isDisabled={conversation.status === 'resolved'}
            >
              Mark as Resolved
            </Button>
          </Box>
        </VStack>
      </Flex>
    </Box>
  );
};

export default ConversationView;
